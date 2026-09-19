/* ============================================================
   CHAINBREAK — tutorial.js
   A guided run-through of the real mechanics.

   It uses the real ledger, the real chain and the real UI — the
   cards are genuine and the hashes are genuinely computed. What it
   removes is pressure: no round clock, no card timer, no scoring,
   no integrity loss. A wrong answer just explains itself and lets
   the player try again.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};
  var U = CB.util;
  var UI = CB.ui;
  var A = CB.audio;

  var T = {
    active: false,
    step: 0,
    steps: [],
    state: null,
    onFinish: null,
    pair: null
  };

  /* ------------------------------------------------------------
     COACH BAR
     ------------------------------------------------------------ */
  function coach(opts) {
    var bar = document.getElementById('coach');
    if (!bar) return;
    bar.hidden = false;
    U.clear(bar);

    var left = U.el('div', 'coach-step');
    left.appendChild(U.el('b', null, 'STEP ' + (T.step + 1)));
    left.appendChild(U.el('span', null, 'OF ' + T.steps.length));
    bar.appendChild(left);

    var mid = U.el('div', 'coach-body');
    mid.appendChild(U.el('div', 'coach-title', opts.title));
    var p = U.el('div', 'coach-text');
    p.innerHTML = opts.text;
    mid.appendChild(p);
    bar.appendChild(mid);

    var right = U.el('div', 'coach-actions');
    if (opts.next) {
      var nx = U.el('button', 'btn btn-small', opts.nextLabel || 'CONTINUE');
      nx.type = 'button';
      nx.id = 'coach-next';
      nx.addEventListener('click', function () { A.play('ui'); advance(); });
      right.appendChild(nx);
    }
    var skip = U.el('button', 'btn-ghost', 'SKIP TO GAME');
    skip.type = 'button';
    skip.id = 'coach-skip';
    skip.addEventListener('click', function () { A.play('ui'); finish(); });
    right.appendChild(skip);
    bar.appendChild(right);
  }

  function hideCoach() {
    var bar = document.getElementById('coach');
    if (bar) { bar.hidden = true; U.clear(bar); }
  }

  function nudge(text) {
    var p = document.querySelector('#coach .coach-text');
    if (!p) return;
    p.innerHTML = '<span class="coach-warn">' + text + '</span>';
    var bar = document.getElementById('coach');
    bar.classList.remove('shake');
    void bar.offsetWidth;
    bar.classList.add('shake');
  }

  /* ------------------------------------------------------------
     TRANSACTION STEPS
     ------------------------------------------------------------ */

  /** Show a card with no timer, and only accept the correct verdict. */
  function showCard(tx, wantAccept, onRight, wrongMsg) {
    var s = T.state;
    s.active = tx;
    UI.renderTxCard(tx, s.ledger, T.pair && T.pair.flag);
    UI.setTxTimer(1, false);
    UI.renderQueue(s.queue, tx);

    function decide(accept) {
      if (!T.active) return;
      if (accept !== wantAccept) {
        A.play('error');
        nudge(wrongMsg);
        return;
      }
      A.play(accept ? 'accept' : 'reject');
      if (accept) { s.ledger.apply(tx); s.pendingMined.push(tx); }
      UI.dismissTxCard(true);
      UI.setActions([]);
      s.active = null;
      setTimeout(function () { if (T.active) onRight(); }, 420);
    }

    UI.setActions([
      { label: 'REJECT', key: 'R', cls: 'act-reject', onClick: function () { decide(false); } },
      { label: 'ACCEPT', key: 'A', cls: 'act-accept', onClick: function () { decide(true); } }
    ]);
    T.decide = decide;
  }

  function good(main, sub) {
    UI.toast(main, sub, 'ok');
  }

  /* ------------------------------------------------------------
     STEPS
     ------------------------------------------------------------ */
  function buildSteps() {
    var s = T.state;

    return [
      /* 1 — the network */
      function () {
        UI.panelHead('TUTORIAL', 'WELCOME, VALIDATOR');
        UI.renderPrompt({
          icon: '◈',
          title: 'YOU ARE THE VALIDATOR',
          sub: 'Five peers relay transactions to you.<br>'
             + 'You decide what is allowed into the blockchain.<br><br>'
             + 'Everything on the left is live.',
          legend: [
            ['NODES', 'THE PEERS RELAYING TRAFFIC'],
            ['THE CHAIN', 'BLOCKS ALREADY SEALED'],
            ['THIS PANEL', 'WHAT NEEDS YOUR DECISION']
          ]
        });
        UI.setActions([]);
        coach({
          title: 'DEFEND THE NETWORK',
          text: 'Your only job is to keep the chain honest. Let’s walk through the four things that can go wrong.',
          next: true,
          nextLabel: 'BEGIN'
        });
      },

      /* 2 — a good transaction */
      function () {
        UI.panelHead('INCOMING TRANSACTIONS', 'TUTORIAL · RULE 1 OF 3');
        UI.setRules({
          title: 'ACCEPT ONLY IF',
          items: ['<b>SIG</b> VALID', '<b>AMT</b> &le; AVAIL', '<b>NONCE</b> UNUSED']
        });
        var tx = CB.gen.genTx(s.ledger, 'valid', 1, {});
        T.net.emitPacket(1, 'tx');
        showCard(tx, true, function () {
          good('CORRECT', 'THAT PAYMENT WAS SOUND');
          advance();
        }, 'Look again — the signature is valid, the amount fits the balance, and the nonce is unused. This one belongs in the chain.');
        coach({
          title: 'AN HONEST PAYMENT',
          text: 'Check the three boxes at the bottom of the card: <b>SIGNATURE</b> says VALID, the amount is under <b>SENDER AVAIL</b>, and the <b>NONCE</b> is unused. Press <b>ACCEPT</b>.'
        });
      },

      /* 3 — forged signature */
      function () {
        UI.panelHead('INCOMING TRANSACTIONS', 'TUTORIAL · FORGED SIGNATURE');
        var tx = CB.gen.genTx(s.ledger, 'sig', 3, {});
        T.net.emitPacket(3, 'bad');
        showCard(tx, false, function () {
          good('THREAT BLOCKED', 'FORGED SIGNATURE REJECTED');
          advance();
        }, 'This one is spoofed. The <b>SIGNATURE</b> field reads FORGED, which means the sender did not actually authorise it. Press REJECT.');
        coach({
          title: 'SOMEONE IS PRETENDING',
          text: 'Every payment is signed by its sender. Recompute the signature and it no longer matches — the card says <b>FORGED</b>. Press <b>REJECT</b>.'
        });
      },

      /* 4 — insufficient funds */
      function () {
        UI.panelHead('INCOMING TRANSACTIONS', 'TUTORIAL · SPENDING TOO MUCH');
        var tx = CB.gen.genTx(s.ledger, 'funds', 0, {});
        T.net.emitPacket(0, 'bad');
        showCard(tx, false, function () {
          good('THREAT BLOCKED', 'THE SENDER COULD NOT COVER IT');
          advance();
        }, 'Compare the big amount with <b>SENDER AVAIL</b>. They are trying to spend money they do not have. Press REJECT.');
        coach({
          title: 'MONEY THAT ISN’T THERE',
          text: 'The amount is larger than <b>SENDER AVAIL</b>. A blockchain will not let you spend what you never had. Press <b>REJECT</b>.'
        });
      },

      /* 5 — double spend, first half */
      function () {
        UI.panelHead('INCOMING TRANSACTIONS', 'TUTORIAL · DOUBLE SPEND');
        var pair = CB.gen.genDoubleSpend(s.ledger, 2, 4, {});
        T.pair = { a: pair[0], b: pair[1], flag: true };
        s.queue = [pair[1]];
        T.net.emitPacket(2, 'tx');
        T.net.emitPacket(4, 'bad');
        A.play('warn');
        showCard(pair[0], true, function () {
          good('ACCEPTED', 'THAT NONCE IS NOW SPENT');
          advance();
        }, 'This first one is legitimate on its own — valid signature, enough money, unused nonce. Accept it, then deal with its twin.');
        coach({
          title: 'THE SAME MONEY, TWICE',
          text: 'Look at the mempool below the card: <b>' + pair[0].from + '</b> has sent two payments with the same <b>NONCE '
              + U.pad2(pair[0].nonce) + '</b> — the same coins promised to two people. Only one can ever pass. <b>ACCEPT</b> this one first.'
        });
      },

      /* 6 — double spend, second half */
      function () {
        var b = T.pair.b;
        s.queue = [];
        showCard(b, false, function () {
          good('DOUBLE SPEND BLOCKED', 'NETWORK SECURED');
          T.pair = null;
          advance();
        }, 'Check the <b>NONCE</b> field — it now reads USED, and the balance has already gone. This is the double spend. Press REJECT.');
        coach({
          title: 'NOW KILL THE TWIN',
          text: 'Same sender, same nonce. The card now shows <b>NONCE ' + U.pad2(b.nonce)
              + ' USED</b> and the balance is gone. This is the double spend — press <b>REJECT</b>.'
        });
      },

      /* 7 — the tampered block */
      function () {
        UI.panelHead('CHAIN AUDIT', 'TUTORIAL · TAMPERING');
        UI.setRules({ title: 'A BLOCK IS VALID WHEN', items: ['<b>RECALC</b> = <b>HASH</b>'] });
        UI.setActions([]);

        var target = Math.max(1, s.chain.height() - 3);
        s.chain.tamperBlock(target);
        T.target = target;
        A.play('warn');
        T.net.shake(1);

        UI.renderPrompt({
          icon: '⚠',
          title: 'SOMEONE REWROTE HISTORY',
          sub: 'A block’s contents were edited after it was sealed.<br>'
             + 'Every block has been <b>recomputed</b> from its data.<br>'
             + 'One of them no longer matches its own fingerprint.',
          legend: [
            ['HASH', 'THE FINGERPRINT SEALED INTO THE BLOCK'],
            ['RECALC', 'THE FINGERPRINT ITS DATA PRODUCES NOW'],
            ['PREV', 'THE HASH THIS BLOCK COMMITS TO']
          ]
        });

        UI.renderChain(s.chain, {
          showRecalc: true,
          auditable: true,
          onPick: function (i) {
            if (!T.active) return;
            if (i !== T.target) {
              A.play('error');
              UI.flashBlock(i, 'wrongpick', 500);
              nudge('Block ' + U.pad2(i) + '’s <b>RECALC</b> matches its <b>HASH</b>, so that one is untouched. Keep comparing the two rows.');
              return;
            }
            A.play('success');
            UI.renderChain(s.chain, { showRecalc: true, revealBreak: true });
            UI.markBlock(T.target, 'compromised');
            s.chain.restoreBlock(T.target);
            good('TAMPERED BLOCK FOUND', 'CHAIN RESTORED');
            setTimeout(function () {
              if (!T.active) return;
              UI.renderChain(s.chain, {});
              advance();
            }, 1400);
          }
        });

        coach({
          title: 'FIND THE REWRITTEN BLOCK',
          text: 'Each block now shows two fingerprints. <b>HASH</b> is what was sealed in; <b>RECALC</b> is what its data produces today. They match on every honest block. <b>Click the one where they differ.</b>'
        });
      },

      /* 8 — done */
      function () {
        UI.panelHead('TUTORIAL COMPLETE', 'YOU’RE READY');
        UI.setActions([]);
        UI.renderPrompt({
          icon: '✓',
          title: 'THAT’S THE JOB',
          sub: 'Forged signatures. Overspending. Double spends.<br>'
             + 'Rewritten blocks.<br><br>'
             + 'The real round adds two more: peers that lie,<br>and an attacker trying to take the majority.',
          legend: [
            ['120 SECONDS', 'ONE ROUND'],
            ['A / R', 'ACCEPT AND REJECT FROM THE KEYBOARD'],
            ['COMBO', 'CONSECUTIVE CORRECT CALLS MULTIPLY YOUR SCORE']
          ]
        });
        coach({
          title: 'READY TO DEFEND THE NETWORK?',
          text: 'In the real round the clock runs and mistakes cost chain integrity. Hit 0% and the chain collapses.',
          next: true,
          nextLabel: 'START GAME'
        });
      }
    ];
  }

  /* ------------------------------------------------------------
     FLOW
     ------------------------------------------------------------ */
  function advance() {
    T.step++;
    if (T.step >= T.steps.length) { finish(); return; }
    T.steps[T.step]();
  }

  function finish() {
    if (!T.active) return;
    T.active = false;
    hideCoach();
    UI.setActions([]);
    if (T.onFinish) T.onFinish();
  }

  /**
   * Run the tutorial. `net` is the shared Network view so the mesh keeps
   * animating; `onFinish` hands control back to the caller.
   */
  T.run = function (state, net, onFinish) {
    T.state = state;
    T.net = net;
    T.onFinish = onFinish;
    T.active = true;
    T.step = 0;
    T.pair = null;

    state.reset();

    // A few real sealed blocks to audit later.
    var seed = [], i, j, txs, t;
    for (i = 0; i < 3; i++) {
      t = CB.gen.genTx(state.ledger, 'valid', null, {});
      state.ledger.apply(t); seed.push(t);
    }
    state.chain.createGenesis(seed);
    for (i = 0; i < 4; i++) {
      txs = [];
      for (j = 0; j < 3; j++) {
        t = CB.gen.genTx(state.ledger, 'valid', null, {});
        if (state.ledger.validate(t).ok) { state.ledger.apply(t); txs.push(t); }
      }
      if (txs.length) state.chain.addBlock(txs, { minedBy: 'NODE 0' + (1 + (i % 5)) });
    }

    net.init(U.$('#net-canvas'), U.$('#node-layer'), state);
    net.setSelectable(false, null);

    UI.resetHud();
    UI.renderChain(state.chain, {});
    UI.scrollChainEnd(false);
    UI.nodeMeta('5 ONLINE · TUTORIAL MODE', 'good');
    UI.netAlert(null);
    UI.log('TUTORIAL MODE · NO SCORING, NO TIME LIMIT', 'info');

    T.steps = buildSteps();
    T.steps[0]();
  };

  T.isActive = function () { return T.active; };

  /** A / R decide a card; Space or Enter advances a read-only step. */
  T.key = function (e) {
    if (!T.active) return false;
    var k = e.key.toLowerCase();

    if (T.decide && T.state.active) {
      if (k === 'a') { e.preventDefault(); T.decide(true); return true; }
      if (k === 'r') { e.preventDefault(); T.decide(false); return true; }
      return false;
    }
    if (k === ' ' || k === 'enter') {
      var nx = document.getElementById('coach-next');
      if (nx) { e.preventDefault(); nx.click(); return true; }
    }
    return false;
  };

  CB.Tutorial = T;
})(window);
