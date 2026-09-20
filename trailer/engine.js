/* ============================================================
   CHAINBREAK — trailer/engine.js
   Rendering primitives and the original score.

   Everything is drawn to one 1080x1920 canvas so the whole piece can
   be captured straight to video. The palette, typography and shapes
   are lifted from the game itself — this is the same visual language,
   not a reinterpretation of it.
   ============================================================ */
(function (root) {
  'use strict';

  var TR = root.TR = {};

  /* ---------- canvas geometry ---------- */
  TR.W = 1080;
  TR.H = 1920;

  /* ---------- the game's palette ---------- */
  var C = TR.C = {
    bg: '#04070c',
    surface: '#0a111c',
    surface2: '#0d1624',
    line: '#17283d',
    lineSoft: '#112035',
    txt: '#d7e6f5',
    dim: '#7b93ad',
    faint: '#4a6180',
    cy: '#00e5ff',
    cyDim: '#0a7f90',
    ok: '#2ee6a8',
    bad: '#ff3d63',
    warn: '#ffb020',
    violet: '#8b7bff'
  };

  var MONO = '"JetBrains Mono","SF Mono","Cascadia Mono",Consolas,"Roboto Mono",ui-monospace,monospace';
  TR.MONO = MONO;

  /* ---------- maths ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /** Normalised progress of `t` across [a,b], clamped. */
  function span(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  /** 0 -> 1 -> 0 across the span, for a flash or a text card. */
  function pulse(t, a, b, riseFrac) {
    var p = span(t, a, b), r = riseFrac == null ? 0.18 : riseFrac;
    return p < r ? easeOut(p / r) : easeOut(1 - (p - r) / (1 - r));
  }
  TR.clamp = clamp; TR.lerp = lerp; TR.span = span;
  TR.ease = ease; TR.easeOut = easeOut; TR.easeIn = easeIn; TR.pulse = pulse;

  /* ---------- deterministic randomness ----------
     Seeded so every render of the trailer is identical — the same hash
     strings, the same particle drift, every single time. */
  var seed = 1337;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  TR.reseed = function (s) { seed = s >>> 0; };
  TR.rnd = rnd;
  TR.rndRange = function (a, b) { return a + rnd() * (b - a); };

  /* ---------- the game's hash, so the digests are real ---------- */
  function hash32(str) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 15; h = Math.imul(h, 0x2545f491) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }
  TR.digest = function (s) {
    var a = hash32(s).toString(16).toUpperCase();
    var b = hash32(s + '|s').toString(16).toUpperCase();
    return (a + b).replace(/[^0-9A-F]/g, '').padEnd(6, '0').slice(0, 6);
  };
  var HEX = '0123456789ABCDEF';
  TR.randomHex = function (n) {
    var s = '', i;
    for (i = 0; i < n; i++) s += HEX[Math.floor(rnd() * 16)];
    return s;
  };

  /* ============================================================
     TEXT
     ============================================================ */

  /**
   * Letterspaced mono type. Canvas has no letter-spacing, so each glyph
   * is placed by hand — which also lets the title animate per character.
   */
  TR.text = function (ctx, str, opts) {
    var o = opts || {};
    var size = o.size || 48;
    var track = o.track == null ? size * 0.24 : o.track;
    var weight = o.weight || 700;
    var chars = String(str).split('');

    /* Auto-fit: nothing in this trailer is ever allowed to run off the
       edge of a 1080-wide frame. Measure first, shrink if needed. */
    var limit = o.maxWidth == null ? TR.W - 80 : o.maxWidth;
    ctx.save();
    ctx.font = weight + ' ' + size + 'px ' + MONO;
    var measure = function () {
      return chars.reduce(function (a, ch) { return a + ctx.measureText(ch).width; }, 0)
        + track * (chars.length - 1);
    };
    var total = measure();
    if (total > limit) {
      var k = limit / total;
      size = size * k; track = track * k;
      ctx.font = weight + ' ' + size + 'px ' + MONO;
      total = measure();
    }

    ctx.textBaseline = o.baseline || 'middle';
    var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });

    var x = o.x == null ? (TR.W - total) / 2 : (o.align === 'left' ? o.x : o.x - total / 2);
    var y = o.y || TR.H / 2;

    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = o.glowSize || size * 0.9;
    }
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = o.color || C.txt;

    var reveal = o.reveal == null ? 1 : o.reveal;      // 0..1 typewriter
    var shown = Math.ceil(chars.length * reveal);

    for (var i = 0; i < chars.length; i++) {
      if (i >= shown) break;
      var jx = 0, jy = 0;
      if (o.jitter) { jx = (rnd() - 0.5) * o.jitter; jy = (rnd() - 0.5) * o.jitter; }
      ctx.fillText(chars[i], x + jx, y + jy);
      x += widths[i] + track;
    }
    ctx.restore();
    return total;
  };

  TR.textWidth = function (ctx, str, size, track, weight) {
    ctx.save();
    ctx.font = (weight || 700) + ' ' + size + 'px ' + MONO;
    var chars = String(str).split('');
    var t = track == null ? size * 0.24 : track;
    var w = chars.reduce(function (a, ch) { return a + ctx.measureText(ch).width; }, 0)
      + t * (chars.length - 1);
    ctx.restore();
    return w;
  };

  /* ============================================================
     ATMOSPHERE
     ============================================================ */

  TR.clear = function (ctx, colour) {
    ctx.fillStyle = colour || C.bg;
    ctx.fillRect(0, 0, TR.W, TR.H);
  };

  /** The engineering grid from the game's background. */
  TR.grid = function (ctx, alpha, offset) {
    if (alpha <= 0) return;
    var step = 92, i;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.cy;
    ctx.lineWidth = 1;
    var off = (offset || 0) % step;
    ctx.beginPath();
    for (i = -1; i * step < TR.H + step; i++) {
      var y = i * step + off;
      ctx.moveTo(0, y); ctx.lineTo(TR.W, y);
    }
    for (i = -1; i * step < TR.W + step; i++) {
      var x = i * step;
      ctx.moveTo(x, 0); ctx.lineTo(x, TR.H);
    }
    ctx.stroke();
    ctx.restore();
  };

  /** Hex characters drifting in the dark. */
  var hexField = [];
  TR.initHexField = function (n) {
    hexField = [];
    for (var i = 0; i < n; i++) {
      hexField.push({
        x: rnd() * TR.W, y: rnd() * TR.H,
        ch: HEX[Math.floor(rnd() * 16)],
        size: 12 + rnd() * 22,
        vy: -6 - rnd() * 22,
        a: 0.12 + rnd() * 0.5,
        flick: rnd() * 100
      });
    }
  };
  TR.hexFieldDraw = function (ctx, t, dt, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (var i = 0; i < hexField.length; i++) {
      var p = hexField[i];
      p.y += p.vy * dt;
      if (p.y < -30) { p.y = TR.H + 30; p.x = rnd() * TR.W; }
      if ((t * 12 + p.flick) % 9 < 0.4) p.ch = HEX[Math.floor(rnd() * 16)];
      ctx.globalAlpha = p.a * alpha;
      ctx.fillStyle = C.cy;
      ctx.font = '400 ' + p.size + 'px ' + MONO;
      ctx.fillText(p.ch, p.x, p.y);
    }
    ctx.restore();
  };

  /** Film grain — keeps flat dark areas from banding. */
  TR.grain = function (ctx, amount) {
    if (amount <= 0) return;
    ctx.save();
    ctx.globalAlpha = amount;
    for (var i = 0; i < 900; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(rnd() * TR.W, rnd() * TR.H, 2, 2);
    }
    ctx.restore();
  };

  TR.vignette = function (ctx, strength) {
    var g = ctx.createRadialGradient(TR.W / 2, TR.H / 2, TR.H * 0.22, TR.W / 2, TR.H / 2, TR.H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (strength == null ? 0.78 : strength) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TR.W, TR.H);
  };

  TR.scanlines = function (ctx, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    for (var y = 0; y < TR.H; y += 4) ctx.fillRect(0, y, TR.W, 2);
    ctx.restore();
  };

  /**
   * Torn horizontal slices — used sparingly, on impacts only.
   * Deliberately NO full-frame additive pass: compositing the whole canvas
   * over itself in 'lighter' mode brightens everything and compounds frame
   * after frame until the picture washes out. Slice displacement alone
   * reads as corruption and leaves the image legible.
   */
  TR.glitch = function (ctx, amount) {
    if (amount <= 0) return;
    amount = clamp(amount, 0, 1);
    var slices = Math.floor(2 + amount * 9);
    for (var i = 0; i < slices; i++) {
      var y = rnd() * TR.H;
      var h = 5 + rnd() * 46 * amount;
      var dx = (rnd() - 0.5) * 90 * amount;
      try { ctx.drawImage(ctx.canvas, 0, y, TR.W, h, dx, y, TR.W, h); } catch (e) {}
    }
    // thin coloured fringes on a couple of slices, not the whole frame
    ctx.save();
    ctx.globalAlpha = 0.5 * amount;
    for (var j = 0; j < 2; j++) {
      var yy = rnd() * TR.H, hh = 3 + rnd() * 10;
      ctx.fillStyle = j ? 'rgba(255,61,99,.5)' : 'rgba(0,229,255,.5)';
      ctx.fillRect((rnd() - 0.5) * 60, yy, TR.W, hh);
    }
    ctx.restore();
  };

  /** Full-frame colour flash on a bass hit. */
  TR.flash = function (ctx, alpha, colour) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = colour || '#ffffff';
    ctx.fillRect(0, 0, TR.W, TR.H);
    ctx.restore();
  };

  TR.letterbox = function (ctx, frac) {
    if (frac <= 0) return;
    var h = TR.H * 0.5 * frac * 0.18;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, TR.W, h);
    ctx.fillRect(0, TR.H - h, TR.W, h);
  };

  /* ============================================================
     NODE MESH
     ============================================================ */

  var nodes = [];
  TR.initNodes = function () {
    // deliberate constellation rather than random scatter
    var pts = [[0.22, 0.30], [0.74, 0.22], [0.50, 0.50], [0.20, 0.72], [0.78, 0.70]];
    nodes = pts.map(function (p, i) {
      return {
        id: i, name: 'NODE 0' + (i + 1),
        x: p[0] * TR.W, y: p[1] * TR.H,
        hostile: false, isolated: false, suspect: false,
        pulse: 0, born: i * 0.42
      };
    });
    return nodes;
  };
  TR.nodes = function () { return nodes; };
  TR.setNodeState = function (i, state) {
    var n = nodes[i]; if (!n) return;
    n.hostile = state === 'hostile';
    n.suspect = state === 'suspect';
    n.isolated = state === 'isolated';
    n.pulse = 1;
  };
  TR.resetNodes = function () {
    nodes.forEach(function (n) { n.hostile = n.suspect = n.isolated = false; n.pulse = 0; });
  };

  function nodeColour(n) {
    if (n.isolated) return '#33455c';
    if (n.hostile) return C.bad;
    if (n.suspect) return C.warn;
    return C.cy;
  }

  /**
   * opts: appear (0..1 how many nodes have arrived), linkAlpha, turbulence,
   *       labels (bool), scale
   */
  TR.drawMesh = function (ctx, t, dt, opts) {
    var o = opts || {};
    var appear = o.appear == null ? 1 : o.appear;
    var turb = o.turbulence || 0;
    var la = o.linkAlpha == null ? 1 : o.linkAlpha;
    var i, j;

    var live = nodes.filter(function (n, idx) { return idx / nodes.length < appear + 0.001; });

    ctx.save();
    if (o.scale && o.scale !== 1) {
      ctx.translate(TR.W / 2, TR.H / 2);
      ctx.scale(o.scale, o.scale);
      ctx.translate(-TR.W / 2, -TR.H / 2);
    }

    /* links */
    for (i = 0; i < live.length; i++) {
      var a = live[i];
      if (a.isolated) continue;
      for (j = i + 1; j < live.length; j++) {
        var b = live[j];
        if (b.isolated) continue;
        var hostile = a.hostile || b.hostile;
        var wave = 0.5 + 0.5 * Math.sin(t * 1.7 + (i * 3 + j) * 1.1);
        var al = (hostile ? 0.26 + wave * 0.44 : 0.10 + wave * 0.20) * la;
        var ox = hostile ? (rnd() - 0.5) * turb * 26 : 0;
        var oy = hostile ? (rnd() - 0.5) * turb * 26 : 0;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x + ox, b.y + oy);
        ctx.strokeStyle = hostile ? C.bad : C.cy;
        ctx.globalAlpha = al;
        ctx.lineWidth = hostile ? 2.6 : 1.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        /* travelling packet */
        var phase = ((t * (hostile ? 0.95 : 0.45) + (i * 7 + j * 3) * 0.17) % 1);
        var px = lerp(a.x, b.x, phase), py = lerp(a.y, b.y, phase);
        ctx.beginPath();
        ctx.arc(px, py, hostile ? 5 : 3.6, 0, Math.PI * 2);
        ctx.fillStyle = hostile ? C.bad : C.cy;
        ctx.globalAlpha = 0.85 * la;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* nodes */
    for (i = 0; i < live.length; i++) {
      var n = live[i];
      n.pulse = Math.max(0, n.pulse - dt * 1.7);
      var col = nodeColour(n);
      var r = 15 + n.pulse * 12;

      if (!n.isolated) {
        var halo = 64 + n.pulse * 60 + Math.sin(t * 2.1 + i) * 7;
        var g = ctx.createRadialGradient(n.x, n.y, 3, n.x, n.y, halo);
        g.addColorStop(0, col + '55');
        g.addColorStop(1, col + '00');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(n.x, n.y, halo, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = n.isolated ? 0.34 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();

      if (o.labels) {
        TR.text(ctx, n.name, {
          x: n.x, y: n.y + r + 34, size: 21, color: col,
          alpha: (n.isolated ? 0.4 : 0.92), track: 4
        });
        if (n.suspect || n.hostile) {
          TR.text(ctx, n.hostile ? 'HOSTILE' : 'SUSPICIOUS', {
            x: n.x, y: n.y + r + 62, size: 16, color: col, alpha: 0.9, track: 3
          });
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  /* ============================================================
     BLOCKS
     ============================================================ */

  /**
   * A single chain block. opts: x, y, w, h, index, hash, prev, alpha,
   * state ('ok'|'bad'|'audit'), recalc, glitchAmt, scale
   */
  TR.drawBlock = function (ctx, o) {
    var w = o.w || 300, h = o.h || 350;
    var x = o.x - w / 2, y = o.y - h / 2;
    var accent = o.state === 'bad' ? C.bad : (o.state === 'audit' ? C.warn : C.cy);

    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;

    if (o.glitchAmt) {
      ctx.translate((rnd() - 0.5) * o.glitchAmt * 22, (rnd() - 0.5) * o.glitchAmt * 10);
    }

    /* body */
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(13,22,36,.97)');
    g.addColorStop(1, 'rgba(9,15,25,.97)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = accent;
    ctx.lineWidth = o.state === 'ok' ? 2 : 3;
    ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (o.state === 'ok' ? 0.55 : 1);
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;

    /* top accent line */
    ctx.fillStyle = accent;
    ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * 0.85;
    ctx.fillRect(x, y, w, 3);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;

    var pad = 20, ty = y + 40;
    TR.text(ctx, 'BLOCK ' + String(o.index).padStart(2, '0'), {
      x: x + pad, y: ty, size: 27, color: '#eafcff', align: 'left', track: 4
    });
    ty += 44;

    TR.text(ctx, 'PREV', { x: x + pad, y: ty, size: 15, color: C.faint, align: 'left', track: 3 });
    TR.text(ctx, o.prev || '000000', {
      x: x + pad + 74, y: ty, size: 20, color: C.violet, align: 'left', track: 3
    });
    ty += 34;

    TR.text(ctx, 'HASH', { x: x + pad, y: ty, size: 15, color: C.faint, align: 'left', track: 3 });
    TR.text(ctx, o.hash || '------', {
      x: x + pad + 74, y: ty, size: 20, color: accent, align: 'left', track: 3,
      glow: o.hashGlow ? accent : null, glowSize: 18
    });
    ty += 34;

    if (o.recalc) {
      TR.text(ctx, 'RECALC', { x: x + pad, y: ty, size: 15, color: C.faint, align: 'left', track: 3 });
      TR.text(ctx, o.recalc, {
        x: x + pad + 92, y: ty, size: 20, color: C.warn, align: 'left', track: 3
      });
      ty += 34;
    }

    /* transaction rows */
    ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * 0.5;
    ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + pad, ty - 6); ctx.lineTo(x + w - pad, ty - 6); ctx.stroke();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ty += 20;

    var rows = o.txs || [['ALICE', 'BOB', 45], ['EMMA', 'LIAM', 30], ['RAVI', 'ZARA', 75]];
    rows.forEach(function (r) {
      TR.text(ctx, r[0].slice(0, 5) + '>' + r[1].slice(0, 5), {
        x: x + pad, y: ty, size: 16, color: C.dim, align: 'left', track: 2, weight: 400
      });
      TR.text(ctx, '£' + r[2], {
        x: x + w - pad - TR.textWidth(ctx, '£' + r[2], 16, 2, 400),
        y: ty, size: 16, color: C.ok, align: 'left', track: 2, weight: 400
      });
      ty += 26;
    });

    ctx.restore();
  };

  /** The connector between two blocks. */
  TR.drawLink = function (ctx, x1, x2, y, opts) {
    var o = opts || {};
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    var col = o.broken ? C.bad : C.cy;
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    if (o.broken) ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.setLineDash([]);
    /* arrow head */
    ctx.beginPath();
    ctx.moveTo(x2, y); ctx.lineTo(x2 - 14, y - 9); ctx.lineTo(x2 - 14, y + 9);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  };

  /* ============================================================
     GAME UI FRAGMENTS
     ============================================================ */

  /** A transaction card, as the game draws it. */
  TR.drawTxCard = function (ctx, o) {
    var w = o.w || 700, h = o.h || 430;
    var x = o.x - w / 2, y = o.y - h / 2;
    var accent = o.verdict === 'bad' ? C.bad : C.cy;

    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.shake) ctx.translate((rnd() - 0.5) * o.shake, (rnd() - 0.5) * o.shake);

    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(14,24,38,.98)');
    g.addColorStop(1, 'rgba(9,16,26,.98)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);

    TR.text(ctx, 'TX ' + (o.id || 'A93F21'), {
      x: x + 26, y: y + 38, size: 19, color: C.cy, align: 'left', track: 3
    });
    var via = 'VIA NODE 0' + (o.node || 2);
    TR.text(ctx, via, {
      x: x + w - 26 - TR.textWidth(ctx, via, 19, 3), y: y + 38, size: 19, color: C.faint, align: 'left', track: 3
    });

    TR.text(ctx, 'SENDER', { x: x + 26, y: y + 96, size: 15, color: C.faint, align: 'left', track: 4 });
    TR.text(ctx, o.from || 'ALICE', { x: x + 26, y: y + 130, size: 34, color: '#eafcff', align: 'left', track: 3 });
    var toW = TR.textWidth(ctx, o.to || 'BOB', 34, 3);
    TR.text(ctx, 'RECEIVER', {
      x: x + w - 26 - TR.textWidth(ctx, 'RECEIVER', 15, 4), y: y + 96, size: 15, color: C.faint, align: 'left', track: 4
    });
    TR.text(ctx, o.to || 'BOB', { x: x + w - 26 - toW, y: y + 130, size: 34, color: '#eafcff', align: 'left', track: 3 });

    /* arrow between parties */
    ctx.strokeStyle = C.cy; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 * (o.alpha == null ? 1 : o.alpha);
    ctx.beginPath(); ctx.moveTo(x + 200, y + 128); ctx.lineTo(x + w - 200, y + 128); ctx.stroke();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;

    TR.text(ctx, '£' + (o.amount == null ? 50 : o.amount), {
      x: TR.W / 2, y: y + 220, size: 74, color: '#fff', glow: C.cy, glowSize: 40, track: 6
    });

    /* three verdict cells */
    var cells = o.cells || [['SENDER AVAIL', '£120', C.ok], ['NONCE', '07', C.txt], ['SIGNATURE', 'VALID', C.ok]];
    var cw = w / 3;
    for (var i = 0; i < 3; i++) {
      var cx = x + cw * i + cw / 2;
      ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + cw * i, y + h - 96); ctx.lineTo(x + cw * i, y + h - 12); ctx.stroke();
      TR.text(ctx, cells[i][0], { x: cx, y: y + h - 72, size: 14, color: C.faint, track: 3 });
      TR.text(ctx, cells[i][1], { x: cx, y: y + h - 38, size: 26, color: cells[i][2], track: 3 });
    }
    ctx.restore();
  };

  /** Big verdict stamp — ACCEPT / REJECT. */
  TR.stamp = function (ctx, label, colour, o) {
    var opt = o || {};
    var size = opt.size || 92;
    var w = TR.textWidth(ctx, label, size, size * 0.3) + 96;
    var h = size + 56;
    var x = (opt.x || TR.W / 2) - w / 2, y = (opt.y || TR.H / 2) - h / 2;
    ctx.save();
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    ctx.translate(TR.W / 2, opt.y || TR.H / 2);
    ctx.scale(opt.scale || 1, opt.scale || 1);
    ctx.translate(-TR.W / 2, -(opt.y || TR.H / 2));
    ctx.strokeStyle = colour; ctx.lineWidth = 5;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, w, h);
    TR.text(ctx, label, {
      y: opt.y || TR.H / 2, size: size, color: colour,
      glow: colour, glowSize: 42, track: size * 0.3
    });
    ctx.restore();
  };

  /** CHAIN INTEGRITY meter. */
  TR.integrity = function (ctx, value, o) {
    var opt = o || {};
    var w = opt.w || 640, h = 16;
    var x = TR.W / 2 - w / 2, y = opt.y || 300;
    var col = value < 45 ? C.bad : (value < 75 ? C.warn : C.ok);
    ctx.save();
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    TR.text(ctx, 'CHAIN INTEGRITY', { x: TR.W / 2, y: y - 44, size: 20, color: C.faint, track: 7 });
    ctx.fillStyle = '#0d1a2a'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 26;
    ctx.fillRect(x, y, w * clamp(value / 100, 0, 1), h);
    ctx.shadowBlur = 0;
    TR.text(ctx, Math.round(value) + '%', {
      x: TR.W / 2, y: y + 58, size: 52, color: col, glow: col, glowSize: 26, track: 6
    });
    ctx.restore();
  };

  /** Warning banner bar. */
  TR.banner = function (ctx, label, colour, o) {
    var opt = o || {};
    var size = opt.size || 34;
    var w = TR.textWidth(ctx, label, size, size * 0.26) + 80;
    var h = size + 44;
    var y = opt.y || TR.H / 2;
    ctx.save();
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    ctx.fillStyle = colour + '22';
    ctx.fillRect(TR.W / 2 - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = colour; ctx.lineWidth = 2;
    ctx.strokeRect(TR.W / 2 - w / 2, y - h / 2, w, h);
    TR.text(ctx, label, { y: y, size: size, color: colour, track: size * 0.26, glow: colour, glowSize: 20 });
    ctx.restore();
  };

  root.TR = TR;
})(window);
