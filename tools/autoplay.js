/* ============================================================
   CHAINBREAK — autoplay harness (development only)

   Plays a full round using ONLY what is rendered on screen and the
   real DOM controls. If this can finish a round, a human looking at
   the same pixels has everything they need too.

   Paste into the console, then: CBAuto.run()
   ============================================================ */
(function (root) {
  'use strict';

  var log = [];
  function note(s) { log.push(s); }

  function q(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function txt(n) { return n ? n.textContent.trim() : ''; }
  function num(s) { return Number(String(s).replace(/[^0-9.]/g, '')) || 0; }

  /* ---- read the visible transaction card ---- */
  function readCard() {
    var card = q('#active-tx');
    if (!card) return null;
    var cells = qa('.tx-meta .m', card);
    var get = function (label) {
      for (var i = 0; i < cells.length; i++) {
        if (txt(q('.m-k', cells[i])) === label) return txt(q('.m-v', cells[i]));
      }
      return '';
    };
    return {
      from: txt(q('.tx-party.from .p-name', card)),
      to: txt(q('.tx-party.to .p-name', card)),
      amount: num(txt(q('.tx-amount', card))),
      avail: num(get('SENDER AVAIL')),
      nonce: get('NONCE'),
      sig: get('SIGNATURE')
    };
  }

  /* ---- the rule the player is told, applied to the pixels ---- */
  function shouldAccept(c) {
    if (c.sig !== 'VALID') return false;
    if (/USED/.test(c.nonce)) return false;
    if (c.amount > c.avail) return false;
    return true;
  }

  var errorRate = 0;

  function doStream() {
    var c = readCard();
    if (!c) return false;
    var accept = shouldAccept(c);
    if (errorRate && Math.random() < errorRate) accept = !accept;   // simulate a fallible player
    var btn = q(accept ? '.act-accept' : '.act-reject');
    if (!btn) return false;
    btn.click();
    return true;
  }

  /* ---- block builder: pick the chips the UI marks as sound ---- */
  function doBuild() {
    var chips = qa('#panel-body .chip');
    if (!chips.length) return false;
    var picked = 0;
    chips.forEach(function (ch) {
      var tag = txt(q('.c-sig', ch));
      var good = q('.c-sig.ok', ch) && tag.indexOf('✓') >= 0;
      var on = ch.classList.contains('on');
      if (good && !on && picked < 4) { ch.click(); picked++; }
      else if (!good && on) ch.click();
      else if (on) picked++;
    });
    var mine = q('#btn-mine');
    if (mine && !mine.disabled) { mine.click(); note('mined a block'); return true; }
    return false;
  }

  /* ---- audit: find the block whose RECALC differs from HASH ---- */
  function doAudit() {
    var blocks = qa('.blk.auditable');
    if (!blocks.length) return false;
    for (var i = 0; i < blocks.length; i++) {
      var rows = qa('.hr', blocks[i]);
      var stored = null, recalc = null;
      rows.forEach(function (r) {
        var k = txt(q('b', r));
        if (k === 'HASH') stored = txt(q('span', r));
        if (k === 'RECALC') recalc = txt(q('span', r));
      });
      if (stored && recalc && stored !== recalc) {
        blocks[i].click();
        note('audited: clicked block with ' + stored + ' != ' + recalc);
        return true;
      }
    }
    return false;
  }

  /* ---- peers: isolate the one whose record shows invalid broadcasts ---- */
  function doNodes() {
    var nodes = qa('.node.selectable');
    if (!nodes.length) return false;
    var worst = null, worstBad = 0;
    nodes.forEach(function (n) {
      var bad = qa('.n-record i.bad', n).length;
      if (n.classList.contains('hostile')) bad += 10;
      if (bad > worstBad) { worstBad = bad; worst = n; }
    });
    if (worst && worstBad > 0) {
      worst.click();
      note('isolated ' + txt(q('.n-id', worst)) + ' (bad broadcasts: ' + worstBad + ')');
      return true;
    }
    return false;
  }

  var timer = null;

  function step() {
    if (!q('#screen-game').classList.contains('is-active')) return;
    doAudit();
    doNodes();
    if (!doBuild()) doStream();
  }

  root.CBAuto = {
    run: function (intervalMs, errRate) {
      clearInterval(timer);
      log = [];
      errorRate = errRate || 0;
      timer = setInterval(step, intervalMs || 420);
      return 'autoplay running';
    },

    /** Play one complete round at a given cadence and return the result. */
    round: function (intervalMs, errRate) {
      return new Promise(function (resolve) {
        var startBtn = q('#btn-start') || q('#btn-again');
        var onEnd = CB.Game.onOver;
        CB.Game.onOver = function (reason) {
          onEnd(reason);
          CB.Game.onOver = onEnd;
          clearInterval(timer);
          var s = CB.Game.state;
          resolve({
            reason: reason,
            score: s.score,
            integrity: Math.round(s.integrity),
            title: s.titleForScore(),
            height: s.chain.height(),
            bestStreak: s.bestStreak,
            stats: JSON.parse(JSON.stringify(s.stats)),
            actions: log.slice()
          });
        };
        if (q('#screen-start').classList.contains('is-active')) {
          startBtn.click();
          setTimeout(function () {
            q('#btn-skip-onboard').click();
            root.CBAuto.run(intervalMs, errRate);
          }, 200);
        } else {
          q('#btn-again').click();
          setTimeout(function () { root.CBAuto.run(intervalMs, errRate); }, 200);
        }
      });
    },
    stop: function () { clearInterval(timer); return 'stopped'; },
    log: function () { return log; },
    readCard: readCard,
    shouldAccept: shouldAccept
  };
})(window);
