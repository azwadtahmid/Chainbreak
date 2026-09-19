/* ============================================================
   CHAINBREAK — leaderboard.js
   Local only. localStorage when available, in-memory otherwise.
   No account, no network, no backend.

   Security posture: localStorage is writable by anyone with devtools
   on this machine, so everything read back out is treated as UNTRUSTED
   input and re-validated — same allowlist as on the way in. Names are
   also rendered with textContent, never innerHTML, so this is defence
   in depth rather than the only thing standing between us and stored
   XSS.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};

  var KEY = 'chainbreak.leaderboard.v1';
  var STATS_KEY = 'chainbreak.stats.v1';
  var MAX = 8;              // rows shown
  var MAX_STORED = 50;      // rows kept
  var MAX_NAME = 12;

  var memory = [];
  var memStats = { plays: 0, best: 0 };
  var persistent = false;

  (function probe() {
    try {
      var t = '__cb_probe__';
      root.localStorage.setItem(t, '1');
      root.localStorage.removeItem(t);
      persistent = true;
    } catch (e) { persistent = false; }
  })();

  /* ---------- validation ---------- */

  /** Strict allowlist. Anything that could open a tag simply cannot survive. */
  function cleanName(name) {
    var n = String(name == null ? '' : name)
      .toUpperCase()
      .replace(/[^A-Z0-9 _.\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME);
    return n || 'VALIDATOR';
  }

  function cleanInt(v, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) return lo;
    n = Math.round(n);
    return n < lo ? lo : (n > hi ? hi : n);
  }

  /** Rebuild a row from untrusted input, keeping only fields we know. */
  function cleanRow(r) {
    if (!r || typeof r !== 'object') return null;
    if (typeof r.name !== 'string' || typeof r.score !== 'number') return null;
    return {
      name: cleanName(r.name),
      score: cleanInt(r.score, 0, 9999999),
      integrity: cleanInt(r.integrity, 0, 100),
      at: cleanInt(r.at, 0, 4102444800000),
      rid: typeof r.rid === 'string' ? r.rid.replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 40) : ''
    };
  }

  function byScore(a, b) { return b.score - a.score || a.at - b.at; }

  /* ---------- storage ---------- */

  function read() {
    if (!persistent) return memory.slice();
    var raw;
    try { raw = root.localStorage.getItem(KEY); } catch (e) { return memory.slice(); }
    if (!raw || raw.length > 200000) return [];
    var arr;
    try { arr = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(arr)) return [];
    var out = [], i, row;
    for (i = 0; i < arr.length && out.length < MAX_STORED; i++) {
      row = cleanRow(arr[i]);
      if (row) out.push(row);
    }
    return out;
  }

  function write(rows) {
    memory = rows.slice(0, MAX_STORED);
    if (!persistent) return;
    try { root.localStorage.setItem(KEY, JSON.stringify(memory)); }
    catch (e) { persistent = false; }
  }

  function readStats() {
    if (!persistent) return { plays: memStats.plays, best: memStats.best };
    var raw;
    try { raw = root.localStorage.getItem(STATS_KEY); } catch (e) { return { plays: 0, best: 0 }; }
    if (!raw || raw.length > 4000) return { plays: 0, best: 0 };
    var o;
    try { o = JSON.parse(raw); } catch (e) { return { plays: 0, best: 0 }; }
    if (!o || typeof o !== 'object') return { plays: 0, best: 0 };
    return { plays: cleanInt(o.plays, 0, 9999999), best: cleanInt(o.best, 0, 9999999) };
  }

  function writeStats(s) {
    memStats = { plays: s.plays, best: s.best };
    if (!persistent) return;
    try { root.localStorage.setItem(STATS_KEY, JSON.stringify(memStats)); }
    catch (e) { persistent = false; }
  }

  CB.board = {
    isPersistent: function () { return persistent; },

    /** Top rows for display. */
    list: function (n) {
      return read().sort(byScore).slice(0, n || MAX);
    },

    /** Everything kept, for the full-board view. */
    listAll: function () { return read().sort(byScore); },

    /**
     * Count a completed round. Called once per real round that reaches
     * the end screen — never by the tutorial, which has no score.
     */
    recordPlay: function (score) {
      var s = readStats();
      s.plays += 1;
      var sc = cleanInt(score, 0, 9999999);
      if (sc > s.best) s.best = sc;
      writeStats(s);
      return s;
    },

    stats: function () { return readStats(); },

    /** Returns the stored row so the UI can highlight it. */
    add: function (name, score, integrity) {
      var rows = read();
      var row = cleanRow({
        name: name,
        score: Number(score),
        integrity: Number(integrity),
        at: Date.now(),
        rid: 'r' + Date.now() + '-' + Math.floor(Math.random() * 1e6)
      });
      if (!row) return null;
      rows.push(row);
      rows.sort(byScore);
      write(rows.slice(0, MAX_STORED));
      return row;
    },

    /**
     * Remove one entry by its row id. Returns true only if something was
     * actually removed, so the caller can tell a real delete from a stale
     * click on a row that has already gone.
     *
     * The rounds-played counter is deliberately NOT decremented: the round
     * still happened, and saving a name was always optional, so "rounds
     * played" is legitimately higher than "validators listed".
     */
    remove: function (rid) {
      if (typeof rid !== 'string' || !rid) return false;
      var rows = read();
      var kept = rows.filter(function (r) { return r.rid !== rid; });
      if (kept.length === rows.length) return false;
      write(kept);
      return true;
    },

    /** Wipes the board and the counters — the start-of-day reset. */
    clear: function () {
      write([]);
      writeStats({ plays: 0, best: 0 });
    }
  };
})(window);
