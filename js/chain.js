/* ============================================================
   CHAINBREAK — chain.js
   The blockchain model. Everything the game claims about hashes,
   signatures, balances and chain links is actually computed here.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};
  var U = CB.util;

  var txSeq = 0;

  /* ------------------------------------------------------------
     TRANSACTIONS
     ------------------------------------------------------------ */

  /** Canonical serialisation of a transaction's signed fields. */
  function txPayload(t) {
    return t.from + '>' + t.to + ':' + t.amount + '#' + t.nonce;
  }

  /** The signature a legitimate sender would produce. */
  function expectedSig(t) {
    return U.digest('SIG|' + txPayload(t) + '|key:' + t.from);
  }

  /**
   * Create a transaction.
   * `forged: true` attaches a signature that does not match the payload,
   * exactly as a spoofed transaction would look to a validator.
   */
  function createTx(o) {
    txSeq++;
    var t = {
      from: o.from,
      to: o.to,
      amount: o.amount,
      nonce: o.nonce,
      node: o.node || null,
      seq: txSeq,
      conflictsWith: null
    };
    t.id = U.digest('TX|' + txPayload(t) + '|' + t.seq);
    t.sig = o.forged ? U.digest('FORGE|' + t.id + '|' + Math.random()) : expectedSig(t);
    return t;
  }

  /** Real check: recompute the signature and compare. */
  function sigValid(t) { return expectedSig(t) === t.sig; }

  /* ------------------------------------------------------------
     LEDGER  (account balances + spent nonces)
     ------------------------------------------------------------ */
  function Ledger() {
    this.balances = {};
    this.spent = {};      // from -> { nonce: true }
    this.nextNonce = {};  // from -> next unused nonce
  }

  Ledger.prototype.open = function (name, amount) {
    this.balances[name] = amount;
    this.spent[name] = {};
    this.nextNonce[name] = U.randInt(3, 19);
  };
  Ledger.prototype.accounts = function () { return Object.keys(this.balances); };
  Ledger.prototype.avail = function (name) { return this.balances[name] || 0; };
  Ledger.prototype.isSpent = function (name, nonce) {
    return !!(this.spent[name] && this.spent[name][nonce]);
  };
  Ledger.prototype.takeNonce = function (name) {
    var n = this.nextNonce[name] || 1;
    this.nextNonce[name] = n + 1;
    return n;
  };

  /**
   * Validate against current chain state. The order matters and mirrors
   * how a real validator checks: authenticity, then replay/double-spend,
   * then solvency.
   */
  Ledger.prototype.validate = function (t) {
    if (!sigValid(t)) {
      return { ok: false, code: 'SIG', reason: 'FORGED SIGNATURE',
               detail: 'THE SIGNATURE DOES NOT MATCH THE PAYLOAD.' };
    }
    if (this.isSpent(t.from, t.nonce)) {
      return { ok: false, code: 'DOUBLE', reason: 'DOUBLE SPEND',
               detail: 'THE SAME FUNDS WERE SPENT TWICE.' };
    }
    if (this.avail(t.from) < t.amount) {
      return { ok: false, code: 'FUNDS', reason: 'INSUFFICIENT FUNDS',
               detail: t.from + ' CANNOT COVER ' + U.money(t.amount) + '.' };
    }
    return { ok: true, code: 'OK', reason: 'VALID', detail: '' };
  };

  /** Commit a transaction: move value and burn the nonce. */
  Ledger.prototype.apply = function (t) {
    this.balances[t.from] = (this.balances[t.from] || 0) - t.amount;
    this.balances[t.to] = (this.balances[t.to] || 0) + t.amount;
    if (!this.spent[t.from]) this.spent[t.from] = {};
    this.spent[t.from][t.nonce] = true;
  };

  /* ------------------------------------------------------------
     BLOCKS + CHAIN
     ------------------------------------------------------------ */

  function txRoot(txs) {
    return txs.map(txPayload).join('|');
  }

  /** A block's hash is a fingerprint of ALL of its contents. */
  function blockHash(b) {
    return U.digest('BLK|' + b.index + '|' + b.previousHash + '|' + txRoot(b.transactions) + '|' + b.nonce);
  }

  function Chain() {
    this.blocks = [];
  }

  Chain.prototype.head = function () { return this.blocks[this.blocks.length - 1]; };
  Chain.prototype.height = function () { return this.blocks.length; };

  Chain.prototype.createGenesis = function (txs) {
    var b = {
      index: 0,
      timestamp: Date.now(),
      transactions: txs,
      previousHash: '000000',
      nonce: U.randInt(1000, 9999),
      tampered: false
    };
    b.hash = blockHash(b);
    this.blocks.push(b);
    return b;
  };

  Chain.prototype.addBlock = function (txs, opts) {
    var prev = this.head();
    var b = {
      index: prev.index + 1,
      timestamp: Date.now(),
      transactions: txs,
      previousHash: (opts && opts.previousHash) || prev.hash,
      nonce: U.randInt(1000, 9999),
      tampered: false,
      minedBy: (opts && opts.minedBy) || null
    };
    b.hash = blockHash(b);
    this.blocks.push(b);
    return b;
  };

  /**
   * Silently rewrite history inside one block: an attacker changes a
   * recorded amount but leaves the stored hash alone, hoping nobody
   * recomputes it. This is what makes the block detectable.
   */
  Chain.prototype.tamperBlock = function (idx) {
    var b = this.blocks[idx];
    if (!b || !b.transactions.length) return null;
    var t = U.pick(b.transactions);
    b.originalAmount = t.amount;
    b.tamperedTxId = t.id;
    t.amount = t.amount + U.randInt(40, 180);
    b.tampered = true;
    return b;
  };

  Chain.prototype.restoreBlock = function (idx) {
    var b = this.blocks[idx];
    if (!b || !b.tampered) return;
    for (var i = 0; i < b.transactions.length; i++) {
      if (b.transactions[i].id === b.tamperedTxId) {
        b.transactions[i].amount = b.originalAmount;
      }
    }
    b.tampered = false;
    b.hash = blockHash(b);
  };

  /** Recompute every block and report where the chain actually breaks. */
  Chain.prototype.audit = function () {
    var out = [], i, b, recalc, linkOk;
    for (i = 0; i < this.blocks.length; i++) {
      b = this.blocks[i];
      recalc = blockHash(b);
      linkOk = (i === 0) ? (b.previousHash === '000000')
                         : (b.previousHash === this.blocks[i - 1].hash);
      out.push({
        index: i,
        stored: b.hash,
        recalc: recalc,
        hashOk: recalc === b.hash,
        linkOk: linkOk,
        valid: recalc === b.hash && linkOk
      });
    }
    return out;
  };

  /** Index of the first block whose contents no longer match its hash. */
  Chain.prototype.findBroken = function () {
    var a = this.audit(), i;
    for (i = 0; i < a.length; i++) if (!a[i].valid) return i;
    return -1;
  };

  CB.chain = {
    createTx: createTx,
    sigValid: sigValid,
    expectedSig: expectedSig,
    txPayload: txPayload,
    blockHash: blockHash,
    txRoot: txRoot,
    Ledger: Ledger,
    Chain: Chain
  };
})(window);
