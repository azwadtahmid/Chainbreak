/* ============================================================
   CHAINBREAK — main.js
   Screen flow, onboarding, end screen, leaderboard UI, input.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB;
  var U = CB.util;
  var UI = CB.ui;
  var A = CB.audio;
  var Game = CB.Game;
  var $ = U.$, el = U.el;

  var screens = {};
  var startField = null;
  var onboardTimers = [];
  var lastRun = null;

  /* ============================================================
     SCREENS
     ============================================================ */
  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('is-active', k === name);
    });
  }

  /* ============================================================
     ONBOARDING  (~6 seconds, skippable)
     ============================================================ */
  function runOnboarding(done) {
    var lines = Array.prototype.slice.call(document.querySelectorAll('.onboard-line'));
    lines.forEach(function (l) { l.classList.remove('show'); });
    clearOnboarding();

    // One line on screen at a time — the previous one is cleared explicitly
    // rather than relying on its animation having finished.
    // The first line is the longest to read, so it gets the longest slot.
    var schedule = [0, 1900, 3300, 4700];
    var slot = [1900, 1400, 1400, 1500];
    var total = 6200;

    lines.forEach(function (line, i) {
      onboardTimers.push(setTimeout(function () {
        lines.forEach(function (other) { other.classList.remove('show'); });
        line.style.animationDuration = slot[i] + 'ms';
        void line.offsetWidth;
        line.classList.add('show');
        A.play(i === 0 ? 'ui' : 'incoming');
      }, schedule[i]));
    });
    onboardTimers.push(setTimeout(function () {
      lines.forEach(function (l) { l.classList.remove('show'); });
      done();
    }, total));
  }

  function clearOnboarding() {
    onboardTimers.forEach(clearTimeout);
    onboardTimers = [];
  }

  /* ============================================================
     START / RESTART
     ============================================================ */
  function beginRun() {
    A.resume();
    A.play('ui');
    if (startField) { startField.stop(); startField = null; }
    show('onboard');
    runOnboarding(function () {
      clearOnboarding();
      // showing the screen lays it out synchronously, so the canvases can
      // measure themselves straight away
      show('game');
      Game.start();
    });
  }

  /** Guided walk-through, then straight into a real round. */
  function beginTutorial() {
    A.resume();
    A.play('ui');
    if (startField) { startField.stop(); startField = null; }
    show('game');
    Game.runTutorial(function () {
      Game.stopTutorial();
      show('game');
      Game.start();
    });
  }

  /* ============================================================
     END SCREEN
     ============================================================ */
  function showEnd(reason) {
    var s = Game.state;
    var survived = reason === 'survived' && s.integrity > 0;

    // Only a completed real round counts. The tutorial never reaches here
    // (it hands off to Game.start before any scoring), and this guard keeps
    // it that way if the flow ever changes.
    if (s.demo) return;

    lastRun = {
      score: s.score,
      integrity: Math.round(s.integrity),
      survived: survived
    };

    CB.board.recordPlay(s.score);

    $('#end-verdict').textContent = survived ? 'CHAIN SECURED.' : 'CHAIN COLLAPSED.';
    $('#end-verdict').className = 'end-verdict' + (survived ? '' : ' failed');
    $('#end-title').textContent = s.titleForScore();

    $('#end-score').textContent = U.commas(s.score);
    $('#end-integrity').textContent = Math.round(s.integrity) + '%';
    $('#end-threats').textContent = s.stats.threatsStopped;
    $('#end-blocks').textContent = s.stats.blocksVerified;
    $('#end-ds').textContent = s.stats.doubleSpendsCaught;
    $('#end-combo').textContent = '×' + (s.bestStreak >= 10 ? 4 : s.bestStreak >= 6 ? 3 : s.bestStreak >= 3 ? 2 : 1);
    $('#end-nodes').textContent = s.stats.nodesIsolated;

    var note = $('#board-note');
    note.className = 'board-note';
    note.textContent = CB.board.isPersistent()
      ? 'SAVED ON THIS LAPTOP · NO ACCOUNT NEEDED'
      : 'STORAGE UNAVAILABLE · SCORES KEPT FOR THIS SESSION';

    $('#name-input').value = '';
    $('#btn-save').disabled = false;
    $('#name-input').disabled = false;

    renderBoard(null);
    show('end');
    setTimeout(function () { try { $('#name-input').focus(); } catch (e) {} }, 400);
  }

  /**
   * Render a list of rows. Names go in via textContent (el's third
   * argument), never innerHTML — a stored name can never become markup.
   */
  function renderRows(ol, list, opts) {
    opts = opts || {};
    U.clear(ol);
    ol.classList.toggle('manage', !!opts.manage);

    if (!list.length) {
      ol.appendChild(el('li', 'empty', 'NO SCORES YET · BE THE FIRST VALIDATOR'));
      return;
    }

    list.forEach(function (row, i) {
      var li = el('li', opts.highlightId && row.rid === opts.highlightId ? 'me' : '');
      li.appendChild(el('span', 'lb-rank', (i + 1) + '.'));
      li.appendChild(el('span', 'lb-name', row.name));
      if (opts.withDate) li.appendChild(el('span', 'lb-when', formatWhen(row.at)));
      li.appendChild(el('span', 'lb-score', U.commas(row.score)));
      if (opts.manage) li.appendChild(deleteControl(row, li));
      ol.appendChild(li);
    });
  }

  /**
   * Per-row delete, with the confirm built into the row itself: one click
   * arms it, a second confirms. No modal, no browser confirm() — and an
   * accidental click is undone by clicking anywhere else.
   */
  function deleteControl(row, li) {
    var wrap = el('span', 'lb-del');

    var del = el('button', 'del-btn', '✕');
    del.type = 'button';
    del.title = 'Remove ' + row.name;
    del.setAttribute('aria-label', 'Remove ' + row.name + ' from the leaderboard');

    var yes = el('button', 'del-yes', 'DELETE');
    yes.type = 'button';
    var no = el('button', 'del-no', '✕');
    no.type = 'button';
    no.title = 'Keep';

    function disarm() {
      li.classList.remove('arming');
      armedRow = null;
    }

    del.addEventListener('click', function (e) {
      e.stopPropagation();
      if (armedRow && armedRow !== disarm) armedRow();
      li.classList.add('arming');
      armedRow = disarm;
      A.play('ui');
    });

    no.addEventListener('click', function (e) { e.stopPropagation(); disarm(); A.play('ui'); });

    yes.addEventListener('click', function (e) {
      e.stopPropagation();
      var removed = CB.board.remove(row.rid);
      A.play(removed ? 'reject' : 'error');
      armedRow = null;
      showFullBoard();           // re-rank and refresh the totals
      flashBoardNote(removed
        ? row.name + ' REMOVED FROM THE BOARD'
        : 'THAT ENTRY WAS ALREADY GONE');
    });

    wrap.appendChild(del);
    wrap.appendChild(yes);
    wrap.appendChild(no);
    return wrap;
  }

  var armedRow = null;

  function flashBoardNote(text) {
    var note = $('#board-storage-note');
    if (!note) return;
    note.className = 'board-note ok';
    note.textContent = text;
    clearTimeout(note._t);
    note._t = setTimeout(function () { setStorageNote(); }, 2600);
  }

  function setStorageNote() {
    var note = $('#board-storage-note');
    if (!note) return;
    note.className = 'board-note';
    note.textContent = CB.board.isPersistent()
      ? 'SAVED ON THIS LAPTOP · SURVIVES RESTARTS'
      : 'STORAGE UNAVAILABLE · THIS SESSION ONLY';
  }

  function formatWhen(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      return U.pad2(d.getDate()) + '/' + U.pad2(d.getMonth() + 1)
        + ' ' + U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());
    } catch (e) { return ''; }
  }

  /** The compact board on the end screen. Never manageable mid-flow. */
  function renderBoard(highlightId) {
    renderRows($('#leaderboard'), CB.board.list(), { highlightId: highlightId });
  }

  var manageMode = false;

  /** The full-screen Hall of Validators, reachable from the start screen. */
  function showFullBoard() {
    var rows = CB.board.listAll();
    var stats = CB.board.stats();

    var totals = $('#board-totals');
    U.clear(totals);
    [
      ['ROUNDS PLAYED', U.commas(stats.plays)],
      ['VALIDATORS LISTED', U.commas(rows.length)],
      ['HIGH SCORE', U.commas(stats.best)]
    ].forEach(function (pair) {
      var b = el('div', 'bt');
      b.appendChild(el('div', 'bt-k', pair[0]));
      b.appendChild(el('div', 'bt-v', pair[1]));
      totals.appendChild(b);
    });

    renderRows($('#leaderboard-full'), rows, { withDate: true, manage: manageMode });

    armedRow = null;
    renderManageBar(rows.length);
    setStorageNote();
    show('board');
  }

  /**
   * Editing controls live behind a MANAGE toggle rather than sitting on the
   * board: the stall laptop is public, and a delete button next to every
   * name is an invitation to wipe someone's score for a laugh.
   */
  function renderManageBar(rowCount) {
    var bar = $('#board-manage');
    U.clear(bar);
    bar.classList.toggle('on', manageMode);

    var toggle = el('button', 'btn-ghost', manageMode ? 'DONE' : 'MANAGE');
    toggle.type = 'button';
    toggle.id = 'btn-manage';
    toggle.addEventListener('click', function () {
      manageMode = !manageMode;
      clearAllArmed = false;
      A.play('ui');
      showFullBoard();
    });
    bar.appendChild(toggle);

    if (!manageMode) return;

    bar.appendChild(el('span', 'manage-hint',
      rowCount ? 'CLICK ✕ NEXT TO A NAME TO REMOVE IT' : 'NOTHING TO REMOVE'));

    if (!rowCount) return;

    var clearBtn = el('button', 'btn-ghost danger',
      clearAllArmed ? 'CONFIRM · WIPE ALL ' + rowCount : 'CLEAR ALL');
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', function () {
      if (!clearAllArmed) {
        clearAllArmed = true;
        A.play('warn');
        renderManageBar(rowCount);
        clearTimeout(clearAllArmed._t);
        setTimeout(function () {
          if (clearAllArmed) { clearAllArmed = false; renderManageBar(rowCount); }
        }, 4000);
        return;
      }
      clearAllArmed = false;
      CB.board.clear();
      A.play('error');
      showFullBoard();
      flashBoardNote('LEADERBOARD CLEARED · SCORES AND COUNTERS RESET');
    });
    bar.appendChild(clearBtn);
  }

  var clearAllArmed = false;

  /** Leave the board; manage mode never persists to the next visit. */
  function leaveBoard() {
    manageMode = false;
    clearAllArmed = false;
    armedRow = null;
    A.play('ui');
    refreshStartPlays();
    show('start');
  }

  function refreshStartPlays() {
    var stats = CB.board.stats();
    var p = $('#start-plays');
    if (!p) return;
    if (!stats.plays) { p.textContent = 'BE THE FIRST VALIDATOR ON THE BOARD'; return; }
    U.clear(p);
    var b = el('b', null, U.commas(stats.plays));
    p.appendChild(b);
    p.appendChild(document.createTextNode(
      stats.plays === 1 ? ' ROUND PLAYED · HIGH SCORE ' : ' ROUNDS PLAYED · HIGH SCORE '));
    p.appendChild(el('b', null, U.commas(stats.best)));
  }

  /* ============================================================
     WIRING
     ============================================================ */
  function init() {
    screens.start = $('#screen-start');
    screens.board = $('#screen-board');
    screens.onboard = $('#screen-onboard');
    screens.game = $('#screen-game');
    screens.end = $('#screen-end');

    Game.boot();
    Game.onOver = showEnd;

    startField = CB.startField($('#start-canvas'));

    U.on($('#btn-start'), 'click', beginRun);
    U.on($('#btn-demo'), 'click', beginTutorial);
    U.on($('#btn-board'), 'click', function () { A.play('ui'); showFullBoard(); });
    U.on($('#btn-board-back'), 'click', leaveBoard);
    refreshStartPlays();
    U.on($('#btn-again'), 'click', function () {
      A.play('ui');
      show('game');
      Game.start();
    });
    U.on($('#btn-skip-onboard'), 'click', function () {
      clearOnboarding();
      show('game');
      Game.start();
    });

    /* ---- mute ---- */
    function syncMute() {
      var m = A.isMuted();
      [$('#btn-mute'), $('#btn-mute-start')].forEach(function (b) {
        if (!b) return;
        b.classList.toggle('is-muted', m);
        b.setAttribute('aria-pressed', String(m));
        var label = b.querySelector('.mute-label');
        if (label) label.textContent = m ? 'SOUND OFF' : 'SOUND ON';
        b.title = m ? 'Unmute (M)' : 'Mute (M)';
      });
    }
    function toggleMute() { A.toggle(); syncMute(); if (!A.isMuted()) A.play('ui'); }
    U.on($('#btn-mute'), 'click', toggleMute);
    U.on($('#btn-mute-start'), 'click', toggleMute);
    syncMute();

    /* ---- leaderboard save ---- */
    U.on($('#save-form'), 'submit', function (e) {
      e.preventDefault();
      if (!lastRun) return;
      var name = $('#name-input').value;
      var row = CB.board.add(name, lastRun.score, lastRun.integrity);
      renderBoard(row.rid);
      $('#btn-save').disabled = true;
      $('#name-input').disabled = true;
      var note = $('#board-note');
      note.className = 'board-note ok';
      note.textContent = 'SCORE SAVED AS ' + row.name;
      A.play('accept');
    });

    /* ---- join CTA: draw the eye to the QR on screen ---- */
    U.on($('#btn-join'), 'click', function () {
      A.play('ui');
      var qr = $('#qr-box');
      qr.classList.remove('ping');
      void qr.offsetWidth;
      qr.classList.add('ping');
      setTimeout(function () { qr.classList.remove('ping'); }, 1500);
      var note = $('#board-note');
      note.className = 'board-note ok';
      note.textContent = 'SCAN THE QR CODE TO BUY YOUR MEMBERSHIP';
    });

    /* ---- keyboard ---- */
    root.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      var k = e.key.toLowerCase();

      if (k === 'm') { e.preventDefault(); toggleMute(); return; }

      if (screens.start.classList.contains('is-active')) {
        if (k === 'enter' || k === ' ') { e.preventDefault(); beginRun(); }
        if (k === 'l') { e.preventDefault(); A.play('ui'); showFullBoard(); }
        return;
      }
      if (screens.board.classList.contains('is-active')) {
        // Escape backs out one level: an armed row, then manage mode,
        // then the board itself.
        if (k === 'escape' && armedRow) { e.preventDefault(); armedRow(); return; }
        if (k === 'escape' && manageMode) {
          e.preventDefault(); manageMode = false; clearAllArmed = false;
          A.play('ui'); showFullBoard(); return;
        }
        if (k === 'escape' || k === 'enter' || k === ' ' || k === 'l') {
          e.preventDefault();
          leaveBoard();
        }
        return;
      }
      if (screens.onboard.classList.contains('is-active')) {
        if (k === 'enter' || k === ' ' || k === 'escape') {
          e.preventDefault();
          clearOnboarding();
          show('game');
          Game.start();
        }
        return;
      }
      if (screens.end.classList.contains('is-active')) {
        if (k === 'enter' || k === ' ') {
          e.preventDefault();
          show('game');
          Game.start();
        }
        return;
      }
      if (screens.game.classList.contains('is-active')) {
        if (CB.Tutorial && CB.Tutorial.isActive()) { CB.Tutorial.key(e); return; }
        Game.key(e);
      }
    });

    /* a round freezes rather than draining while the tab is hidden */
    document.addEventListener('visibilitychange', function () {
      Game.setHidden(document.hidden);
    });

    /* first gesture unlocks WebAudio on strict browsers */
    root.addEventListener('pointerdown', function once() {
      A.resume();
      root.removeEventListener('pointerdown', once);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
