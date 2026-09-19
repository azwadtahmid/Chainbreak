/* ============================================================
   CHAINBREAK — util.js
   Random helpers, deterministic hashing, DOM helpers.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};

  /* ---------- random ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
  function chance(p) { return Math.random() < p; }
  function shuffle(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = randInt(0, i);
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- deterministic hash (FNV-1a 32 + avalanche) ----------
     Not cryptographic. It is a real, content-dependent fingerprint:
     the same bytes always give the same digest, and one changed byte
     gives a completely different digest. That is all the game needs
     for its hash-link mechanics to be genuine rather than faked.      */
  function hash32(str) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 15;
    h = Math.imul(h, 0x2545f491) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x27d4eb2f) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** 6-character uppercase hex digest, e.g. "8F2A91". */
  function digest(str) {
    var a = hash32(str).toString(16).toUpperCase();
    var b = hash32(str + '|s').toString(16).toUpperCase();
    return (a + b).replace(/[^0-9A-F]/g, '').padEnd(6, '0').slice(0, 6);
  }

  /* ---------- formatting ---------- */
  function money(n) { return '£' + n; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function commas(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ---------- DOM ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function on(node, evt, fn) { if (node) node.addEventListener(evt, fn); }

  var reduceMotion = false;
  try {
    var mq = root.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    if (mq.addEventListener) mq.addEventListener('change', function (e) { CB.util.reduceMotion = e.matches; });
  } catch (e) { /* older browser: keep motion on */ }

  CB.util = {
    rand: rand, randInt: randInt, pick: pick, chance: chance, shuffle: shuffle,
    clamp: clamp, lerp: lerp,
    hash32: hash32, digest: digest,
    money: money, pad2: pad2, commas: commas,
    $: $, el: el, clear: clear, on: on,
    reduceMotion: reduceMotion
  };
})(window);
