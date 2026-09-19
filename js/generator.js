/* ============================================================
   CHAINBREAK — generator.js
   Builds accounts and transactions.

   Hard rule: every generated situation has exactly one correct
   response under the ledger rules. Randomness changes the names,
   amounts, order and which threat appears — never whether the
   answer is knowable.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};
  var U = CB.util;
  var C = CB.chain;

  var NAMES = [
    'ALICE', 'BOB', 'CHARLIE', 'DAVID', 'EMMA', 'LIAM', 'NOAH', 'OLIVIA',
    'PRIYA', 'RAVI', 'SOFIA', 'JONAS', 'MAYA', 'OMAR', 'ZARA', 'LUCA',
    'NINA', 'KOFI', 'IVY', 'HUGO', 'AMARA', 'TOMAS', 'LEILA', 'FINN'
  ];

  /** Fresh set of accounts with comfortable, readable balances. */
  function buildLedger(count) {
    var led = new C.Ledger();
    var names = U.shuffle(NAMES).slice(0, count || 9);
    names.forEach(function (n) {
      led.open(n, U.randInt(8, 26) * 10);   // 80 .. 260
    });
    return led;
  }

  /**
   * A sender who can currently afford a meaningful payment and has nothing
   * else in flight. One pending transaction per account means the balance
   * printed on a card is still the balance that decides it.
   */
  function solventSender(led, min, busy) {
    busy = busy || {};
    var free = led.accounts().filter(function (a) { return !busy[a]; });
    var pool = free.filter(function (a) { return led.avail(a) >= (min || 60); });

    if (!pool.length) {
      // top the network up rather than ever emitting an unanswerable card
      led.accounts().forEach(function (a) {
        if (led.avail(a) < (min || 60)) led.balances[a] += U.randInt(8, 16) * 10;
      });
      pool = free.length ? free : led.accounts();
    }
    return U.pick(pool);
  }

  function otherThan(led, name) {
    var pool = led.accounts().filter(function (a) { return a !== name; });
    return U.pick(pool);
  }

  function round5(n) { return Math.max(5, Math.round(n / 5) * 5); }

  /**
   * Generate one transaction of a given kind.
   *   'valid'  — signature good, affordable, fresh nonce
   *   'sig'    — ONLY fault is a forged signature (still affordable)
   *   'funds'  — ONLY fault is spending more than the sender holds
   */
  function genTx(led, kind, node, busy) {
    var from = solventSender(led, 70, busy);
    var to = otherThan(led, from);
    var avail = led.avail(from);
    var amount, forged = false;

    if (kind === 'funds') {
      amount = round5(avail + U.randInt(4, 18) * 10);   // clearly over, never marginal
    } else {
      amount = round5(U.rand(0.18, 0.62) * avail);
      if (amount > avail) amount = round5(avail * 0.5);
      if (kind === 'sig') forged = true;
    }

    return C.createTx({
      from: from, to: to, amount: amount,
      nonce: led.takeNonce(from),
      node: node, forged: forged
    });
  }

  /**
   * A double-spend attempt: the same balance, the same nonce, promised
   * to two different people. Only one can ever enter the chain.
   */
  function genDoubleSpend(led, nodeA, nodeB, busy) {
    var from = solventSender(led, 90, busy);
    var avail = led.avail(from);
    var nonce = led.takeNonce(from);
    var recipients = U.shuffle(led.accounts().filter(function (a) { return a !== from; }));
    var amount = round5(U.rand(0.55, 0.85) * avail);

    var a = C.createTx({ from: from, to: recipients[0], amount: amount, nonce: nonce, node: nodeA });
    var b = C.createTx({ from: from, to: recipients[1], amount: amount, nonce: nonce, node: nodeB });
    a.conflictsWith = b.id;
    b.conflictsWith = a.id;
    a.doubleSpendPair = b.doubleSpendPair = true;
    b.isDoubleSpendAttempt = true;   // the later half of the pair
    return [a, b];
  }

  /**
   * Pool for the block-building phase: exactly `validCount` transactions
   * that belong in the next block, plus `badCount` that must be left out.
   * Every fault is visible on the chip itself.
   */
  function genBlockPool(led, validCount, badCount, busy) {
    // One sender per entry, so each chip can be judged on its own line:
    // no hidden interaction between two pool entries, and none of them
    // touches an account the player still has a live card for.
    var used = {}, pool = [], kinds = [], i, tx, guard;
    if (busy) Object.keys(busy).forEach(function (k) { used[k] = true; });
    for (i = 0; i < validCount; i++) kinds.push('valid');
    for (i = 0; i < badCount; i++) kinds.push(U.chance(0.5) ? 'sig' : 'funds');

    kinds.forEach(function (kind) {
      guard = 0;
      do {
        tx = genTx(led, kind, null, used);
        guard++;
      } while (used[tx.from] && guard < 24);
      used[tx.from] = true;
      tx.poolKind = kind;
      pool.push(tx);
    });
    return U.shuffle(pool);
  }

  CB.gen = {
    NAMES: NAMES,
    buildLedger: buildLedger,
    genTx: genTx,
    genDoubleSpend: genDoubleSpend,
    genBlockPool: genBlockPool,
    solventSender: solventSender,
    otherThan: otherThan
  };
})(window);
