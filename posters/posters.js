/* ============================================================
   CHAINBREAK / Brunel Blockchain Society — Freshers Fair posters

   Five A3 portrait posters, drawn in the game's own visual language:
   same palette, same mono type, same blocks and node mesh. Everything
   is vector-drawn into a canvas, so the same code renders a screen
   preview and a 300dpi print file — no upscaling, no soft edges.

   Design space is 1200 x 1697 (A3 ratio). The renderer scales the
   context to whatever output size is asked for, so type and rules
   stay crisp at any resolution.
   ============================================================ */
(function (root) {
  'use strict';

  var P = root.Posters = {};

  /* A3 portrait, 1:1.414 */
  var W = 1200, H = 1697;
  P.W = W; P.H = H;
  P.A3_300DPI = { w: 3508, h: 4961 };

  var C = {
    bg: '#04070c', surface: '#0a111c', line: '#17283d', lineSoft: '#112035',
    txt: '#d7e6f5', dim: '#7b93ad', faint: '#4a6180',
    cy: '#00e5ff', ok: '#2ee6a8', bad: '#ff3d63', warn: '#ffb020', violet: '#8b7bff'
  };
  var MONO = '"JetBrains Mono","SF Mono","Cascadia Mono",Consolas,"Roboto Mono",ui-monospace,monospace';

  /* deterministic noise, so a reprint is identical to the first print */
  var seed = 90210;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function reseed() { seed = 90210; }

  function hash32(s) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 0x2545f491) >>> 0; h ^= h >>> 13;
    h = Math.imul(h, 0x27d4eb2f) >>> 0; h ^= h >>> 16;
    return h >>> 0;
  }
  function digest(s) {
    var a = hash32(s).toString(16).toUpperCase(), b = hash32(s + '|s').toString(16).toUpperCase();
    return (a + b).replace(/[^0-9A-F]/g, '').padEnd(6, '0').slice(0, 6);
  }

  /* ------------------------------------------------------------
     type
     ------------------------------------------------------------ */

  /** Letterspaced mono, auto-fitted so nothing can ever run off a poster. */
  function txt(ctx, str, o) {
    o = o || {};
    var size = o.size || 40, track = o.track == null ? size * 0.16 : o.track;
    var weight = o.weight || 700;
    var chars = String(str).split('');
    var limit = o.maxWidth || (W - 180);

    ctx.save();
    ctx.font = weight + ' ' + size + 'px ' + MONO;
    var measure = function () {
      return chars.reduce(function (a, ch) { return a + ctx.measureText(ch).width; }, 0)
        + track * (chars.length - 1);
    };
    var total = measure();
    if (total > limit) {
      var k = limit / total;
      size *= k; track *= k;
      ctx.font = weight + ' ' + size + 'px ' + MONO;
      total = measure();
    }
    ctx.textBaseline = o.baseline || 'middle';

    var x = o.align === 'left' ? (o.x || 90)
          : o.align === 'right' ? ((o.x == null ? W - 90 : o.x) - total)
          : ((o.x == null ? W / 2 : o.x) - total / 2);
    var y = o.y || 0;

    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowSize || size * 0.8; }
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = o.color || C.txt;
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, y);
      x += ctx.measureText(chars[i]).width + track;
    }
    ctx.restore();
    return { width: total, size: size };
  }

  function width(ctx, str, size, track, weight) {
    ctx.save();
    ctx.font = (weight || 700) + ' ' + size + 'px ' + MONO;
    var t = track == null ? size * 0.16 : track;
    var w = String(str).split('').reduce(function (a, ch) { return a + ctx.measureText(ch).width; }, 0)
      + t * (str.length - 1);
    ctx.restore();
    return w;
  }

  /** Wrap a sentence to a width and draw it as centred lines. */
  function para(ctx, str, o) {
    var size = o.size || 26, lh = o.lineHeight || size * 1.75;
    var limit = o.maxWidth || (W - 220);
    var words = String(str).split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (width(ctx, test, size, o.track, o.weight || 400) > limit && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    lines.forEach(function (l, i) {
      txt(ctx, l, {
        y: o.y + i * lh, size: size, color: o.color || C.dim,
        track: o.track == null ? size * 0.1 : o.track, weight: o.weight || 400,
        maxWidth: limit, align: o.align, x: o.x
      });
    });
    return o.y + lines.length * lh;
  }

  /* ------------------------------------------------------------
     shared poster chrome
     ------------------------------------------------------------ */

  function background(ctx, opts) {
    var o = opts || {};
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    /* engineering grid */
    ctx.save();
    ctx.globalAlpha = o.gridAlpha == null ? 0.055 : o.gridAlpha;
    ctx.strokeStyle = C.cy; ctx.lineWidth = 1;
    var step = 60, i;
    ctx.beginPath();
    for (i = 0; i * step < H; i++) { ctx.moveTo(0, i * step); ctx.lineTo(W, i * step); }
    for (i = 0; i * step < W; i++) { ctx.moveTo(i * step, 0); ctx.lineTo(i * step, H); }
    ctx.stroke();
    ctx.restore();

    /* accent glow */
    if (o.glowAt) {
      var g = ctx.createRadialGradient(o.glowAt[0], o.glowAt[1], 10, o.glowAt[0], o.glowAt[1], o.glowR || 700);
      g.addColorStop(0, (o.glowColour || C.cy) + '33');
      g.addColorStop(1, (o.glowColour || C.cy) + '00');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  function vignette(ctx, strength) {
    var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.24, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (strength == null ? 0.62 : strength) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function grain(ctx, amount) {
    ctx.save();
    ctx.globalAlpha = amount == null ? 0.035 : amount;
    for (var i = 0; i < 2600; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
    }
    ctx.restore();
  }

  /** Logo lockup, top-left by default. */
  function brandMark(ctx, assets, o) {
    o = o || {};
    var lw = o.size || 130;
    if (assets.logo) {
      var lh = lw * assets.logo.naturalHeight / assets.logo.naturalWidth;
      ctx.save();
      ctx.shadowColor = C.cy; ctx.shadowBlur = 26;
      ctx.drawImage(assets.logo, o.x || 90, o.y || 84, lw, lh);
      ctx.restore();
      return (o.y || 84) + lh;
    }
    return (o.y || 84);
  }

  /** The QR block: white plate, caption. Dark-on-light needs the plate. */
  var FOOTER_RULE_Y = H - 128;      // the hairline above the footer text

  function qrPanel(ctx, assets, o) {
    o = o || {};
    var s = o.size || 230;
    var x = o.x == null ? W - 90 - s : o.x;
    var y = o.y || H - 300;

    // Clamp upward so the caption (and sub-caption) can never be printed
    // on top of the footer. Getting this wrong is invisible on screen and
    // ruins a poster that has already gone to the printer.
    var needed = s + 40 + (o.sub ? 34 : 0) + 24;
    if (y + needed > FOOTER_RULE_Y) y = FOOTER_RULE_Y - needed;
    ctx.save();
    ctx.shadowColor = 'rgba(0,229,255,.55)'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, s, s);
    ctx.restore();
    if (assets.qr) ctx.drawImage(assets.qr, x + 14, y + 14, s - 28, s - 28);

    if (o.caption !== false) {
      txt(ctx, o.caption || 'SCAN TO JOIN', {
        x: x + s / 2, y: y + s + 40, size: 21, color: C.cy, track: 4.5
      });
      if (o.sub) {
        txt(ctx, o.sub, { x: x + s / 2, y: y + s + 72, size: 15, color: C.faint, track: 3 });
      }
    }
    return y + s;
  }

  /** Footer strip carried by every poster. */
  function footer(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(90, H - 128); ctx.lineTo(W - 90, H - 128); ctx.stroke();
    ctx.restore();
    txt(ctx, 'BRUNEL BLOCKCHAIN SOCIETY', {
      x: 90, align: 'left', y: H - 90, size: 24, color: '#eafcff', track: 5
    });
    txt(ctx, 'LEARN. BUILD. CONNECT.', {
      x: W - 90, align: 'right', y: H - 90, size: 19, color: C.cy, track: 5
    });
  }

  /* ------------------------------------------------------------
     game furniture
     ------------------------------------------------------------ */

  function block(ctx, o) {
    var w = o.w || 250, h = o.h || 300;
    var x = o.x - w / 2, y = o.y - h / 2;
    var accent = o.state === 'bad' ? C.bad : (o.state === 'warn' ? C.warn : C.cy);
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(13,22,36,.97)'); g.addColorStop(1, 'rgba(9,15,25,.97)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = o.state ? 3 : 2;
    ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (o.state ? 1 : 0.6);
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = accent; ctx.fillRect(x, y, w, 4);

    var pad = 18, ty = y + 40;
    txt(ctx, 'BLOCK ' + String(o.index).padStart(2, '0'), {
      x: x + pad, align: 'left', y: ty, size: 25, color: '#eafcff', track: 3, maxWidth: w - pad * 2
    });
    ty += 42;
    txt(ctx, 'PREV', { x: x + pad, align: 'left', y: ty, size: 14, color: C.faint, track: 2 });
    txt(ctx, o.prev, { x: x + pad + 62, align: 'left', y: ty, size: 18, color: C.violet, track: 2 });
    ty += 30;
    txt(ctx, 'HASH', { x: x + pad, align: 'left', y: ty, size: 14, color: C.faint, track: 2 });
    txt(ctx, o.hash, { x: x + pad + 62, align: 'left', y: ty, size: 18, color: accent, track: 2 });
    ty += 34;
    if (o.recalc) {
      txt(ctx, 'RECALC', { x: x + pad, align: 'left', y: ty, size: 14, color: C.faint, track: 2 });
      txt(ctx, o.recalc, { x: x + pad + 78, align: 'left', y: ty, size: 18, color: C.warn, track: 2 });
      ty += 32;
    }
    ctx.globalAlpha = 0.45; ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + pad, ty - 8); ctx.lineTo(x + w - pad, ty - 8); ctx.stroke();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ty += 12;
    (o.txs || []).forEach(function (r) {
      txt(ctx, r[0] + '>' + r[1], {
        x: x + pad, align: 'left', y: ty, size: 15, color: C.dim, track: 1, weight: 400
      });
      txt(ctx, '£' + r[2], {
        x: x + w - pad, align: 'right', y: ty, size: 15, color: C.ok, track: 1, weight: 400
      });
      ty += 24;
    });
    ctx.restore();
  }

  function link(ctx, x1, x2, y, broken) {
    ctx.save();
    var col = broken ? C.bad : C.cy;
    ctx.strokeStyle = col; ctx.lineWidth = 4;
    if (broken) ctx.setLineDash([9, 9]);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y); ctx.lineTo(x2 - 13, y - 8); ctx.lineTo(x2 - 13, y + 8);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  }

  /** Node constellation. */
  function mesh(ctx, o) {
    o = o || {};
    var pts = o.points || [[0.16, 0.20], [0.78, 0.13], [0.50, 0.50], [0.14, 0.80], [0.84, 0.72]];
    var box = o.box || { x: 0, y: 0, w: W, h: H };
    var nodes = pts.map(function (p, i) {
      return { x: box.x + p[0] * box.w, y: box.y + p[1] * box.h, hostile: (o.hostile || []).indexOf(i) >= 0 };
    });
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    var i, j;
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        var hostile = nodes[i].hostile || nodes[j].hostile;
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.strokeStyle = hostile ? C.bad : C.cy;
        ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (hostile ? 0.5 : 0.22);
        ctx.lineWidth = hostile ? 2.6 : 1.8;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    nodes.forEach(function (n, i) {
      var col = n.hostile ? C.bad : C.cy;
      var g = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, 72);
      g.addColorStop(0, col + '4d'); g.addColorStop(1, col + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 72, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, 17, 0, Math.PI * 2);
      ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x, n.y, 6, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      if (o.labels) {
        txt(ctx, 'NODE 0' + (i + 1), { x: n.x, y: n.y + 46, size: 16, color: col, track: 3 });
      }
    });
    ctx.restore();
  }

  /** A transaction card as the game draws it. */
  function txCard(ctx, o) {
    var w = o.w || 620, h = o.h || 300;
    var x = o.x - w / 2, y = o.y - h / 2;
    var accent = o.bad ? C.bad : C.cy;
    ctx.save();
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(14,24,38,.98)'); g.addColorStop(1, 'rgba(9,16,26,.98)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);

    txt(ctx, 'TX ' + o.id, { x: x + 22, align: 'left', y: y + 32, size: 17, color: C.cy, track: 2.5 });
    txt(ctx, 'VIA NODE 0' + (o.node || 2), {
      x: x + w - 22, align: 'right', y: y + 32, size: 17, color: C.faint, track: 2.5
    });
    txt(ctx, o.from, { x: x + 22, align: 'left', y: y + 92, size: 30, color: '#eafcff', track: 2.5 });
    txt(ctx, o.to, { x: x + w - 22, align: 'right', y: y + 92, size: 30, color: '#eafcff', track: 2.5 });
    ctx.strokeStyle = C.cy; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 190, y + 90); ctx.lineTo(x + w - 190, y + 90); ctx.stroke();
    ctx.globalAlpha = 1;
    txt(ctx, '£' + o.amount, {
      x: x + w / 2, y: y + 160, size: 62, color: '#fff', glow: C.cy, glowSize: 30, track: 5
    });
    var cells = o.cells, cw = w / 3;
    for (var i = 0; i < 3; i++) {
      var cx = x + cw * i + cw / 2;
      if (i) {
        ctx.strokeStyle = C.lineSoft; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + cw * i, y + h - 78); ctx.lineTo(x + cw * i, y + h - 14); ctx.stroke();
      }
      txt(ctx, cells[i][0], { x: cx, y: y + h - 56, size: 13, color: C.faint, track: 2 });
      txt(ctx, cells[i][1], { x: cx, y: y + h - 28, size: 22, color: cells[i][2], track: 2 });
    }
    ctx.restore();
  }

  /* ============================================================
     THE FIVE POSTERS
     ============================================================ */
  var POSTERS = [];

  /* ---- 1. THE HOOK -------------------------------------------- */
  POSTERS.push({
    id: 'hook', name: '1 — THE HOOK',
    blurb: 'The stall-stopper. Big title, the chain, one question.',
    draw: function (ctx, A) {
      background(ctx, { glowAt: [W / 2, H * 0.30], glowR: 760 });
      brandMark(ctx, A, { size: 120, x: 90, y: 80 });
      txt(ctx, 'BRUNEL BLOCKCHAIN SOCIETY', {
        x: W - 90, align: 'right', y: 120, size: 19, color: C.dim, track: 5
      });

      txt(ctx, 'CHAINBREAK', {
        y: 430, size: 132, color: '#fff', glow: C.cy, glowSize: 70, track: 12, maxWidth: W - 140
      });
      txt(ctx, 'DEFEND THE NETWORK.', { y: 516, size: 33, color: C.cy, track: 8 });
      txt(ctx, 'PROTECT THE CHAIN.', { y: 560, size: 33, color: C.cy, track: 8 });

      /* the chain itself, the hero image */
      var bw = 250, gap = 54, y = 800;
      var xs = [W / 2 - bw - gap, W / 2, W / 2 + bw + gap];
      var hashes = [digest('p|0'), digest('p|1'), digest('p|2')];
      link(ctx, xs[0] + bw / 2 + 5, xs[1] - bw / 2 - 5, y);
      link(ctx, xs[1] + bw / 2 + 5, xs[2] - bw / 2 - 5, y);
      block(ctx, { x: xs[0], y: y, w: bw, index: 0, prev: '000000', hash: hashes[0],
        txs: [['ALICE', 'BOB', 45], ['EMMA', 'LIAM', 30], ['RAVI', 'ZARA', 75]] });
      block(ctx, { x: xs[1], y: y, w: bw, index: 1, prev: hashes[0], hash: hashes[1],
        txs: [['PRIYA', 'OMAR', 60], ['MAYA', 'FINN', 25], ['IVY', 'HUGO', 90]] });
      block(ctx, { x: xs[2], y: y, w: bw, index: 2, prev: hashes[1], hash: hashes[2],
        txs: [['KOFI', 'NINA', 40], ['LUCA', 'ZARA', 55], ['BOB', 'ALICE', 35]] });

      txt(ctx, 'CAN YOU KEEP', { y: 1075, size: 62, color: '#fff', glow: C.cy, glowSize: 36, track: 10 });
      txt(ctx, 'THE CHAIN ALIVE?', { y: 1145, size: 62, color: '#fff', glow: C.cy, glowSize: 36, track: 10 });

      txt(ctx, '120 SECONDS  ·  ONE LAPTOP  ·  ONE SHOT', {
        y: 1230, size: 23, color: C.warn, track: 5
      });

      qrPanel(ctx, A, { y: 1276, x: W - 90 - 200, size: 200, caption: 'PLAY IT HERE', sub: 'AND JOIN THE SOCIETY' });
      para(ctx, 'Step up. Validate the transactions. Catch the fraud. Survive the 51% attack.',
        { y: 1318, x: 90, align: 'left', maxWidth: 660, size: 26, color: C.dim, lineHeight: 44 });

      vignette(ctx); grain(ctx); footer(ctx);
    }
  });

  /* ---- 2. THE CHALLENGE --------------------------------------- */
  POSTERS.push({
    id: 'challenge', name: '2 — THE CHALLENGE',
    blurb: 'Competitive hook. Drives repeat plays and the leaderboard.',
    draw: function (ctx, A) {
      background(ctx, { glowAt: [W / 2, H * 0.22], glowR: 700, glowColour: C.warn });
      brandMark(ctx, A, { size: 110, x: 90, y: 80 });

      txt(ctx, '120', {
        y: 400, size: 300, color: '#fff', glow: C.warn, glowSize: 90, track: 20
      });
      txt(ctx, 'SECONDS TO SAVE', { y: 545, size: 44, color: C.warn, track: 9 });
      txt(ctx, 'THE BLOCKCHAIN', { y: 600, size: 44, color: C.warn, track: 9 });

      /* integrity meter, falling */
      var mw = 900, mx = W / 2 - mw / 2, my = 700;
      txt(ctx, 'CHAIN INTEGRITY', { y: my - 34, size: 21, color: C.faint, track: 7 });
      ctx.fillStyle = '#0d1a2a'; ctx.fillRect(mx, my, mw, 22);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, 22);
      ctx.save();
      ctx.fillStyle = C.bad; ctx.shadowColor = C.bad; ctx.shadowBlur = 30;
      ctx.fillRect(mx, my, mw * 0.43, 22);
      ctx.restore();
      txt(ctx, '43%', { y: my + 74, size: 62, color: C.bad, glow: C.bad, glowSize: 28, track: 7 });

      /* the board */
      var rows = [['1.', 'AZWAD', '22,839'], ['2.', 'SAM', '18,750'], ['3.', 'MAYA', '14,120'], ['4.', 'JONAS', '9,300']];
      txt(ctx, "TODAY'S TOP VALIDATORS", { y: 856, size: 26, color: C.cy, track: 6 });
      rows.forEach(function (r, i) {
        var y = 912 + i * 62, bx = 180, bw2 = W - 360;
        ctx.save();
        ctx.globalAlpha = i === 0 ? 1 : 0.8;
        ctx.fillStyle = i === 0 ? 'rgba(0,229,255,.10)' : 'rgba(12,20,32,.75)';
        ctx.fillRect(bx, y - 26, bw2, 52);
        ctx.strokeStyle = i === 0 ? C.cy : C.lineSoft; ctx.lineWidth = i === 0 ? 2 : 1;
        ctx.strokeRect(bx, y - 26, bw2, 52);
        ctx.restore();
        txt(ctx, r[0], { x: bx + 24, align: 'left', y: y, size: 20, color: C.faint, track: 2 });
        txt(ctx, r[1], { x: bx + 80, align: 'left', y: y, size: 26, color: i === 0 ? C.cy : C.txt, track: 4 });
        txt(ctx, r[2], { x: bx + bw2 - 24, align: 'right', y: y, size: 26, color: i === 0 ? C.cy : '#eafcff', track: 2 });
      });

      txt(ctx, 'BEAT THE HIGH SCORE.', {
        y: 1214, size: 52, color: '#fff', glow: C.cy, glowSize: 34, track: 8
      });
      txt(ctx, 'GET YOUR NAME ON THE BOARD.', { y: 1266, size: 25, color: C.dim, track: 5 });

      qrPanel(ctx, A, { y: 1300, x: W / 2 - 85, size: 170, caption: 'JOIN THE SOCIETY', sub: false });

      vignette(ctx); grain(ctx); footer(ctx);
    }
  });

  /* ---- 3. THE SOCIETY ----------------------------------------- */
  POSTERS.push({
    id: 'society', name: '3 — THE SOCIETY',
    blurb: 'What you actually get for joining. The credibility poster.',
    draw: function (ctx, A) {
      background(ctx, { glowAt: [W / 2, 360], glowR: 640 });
      mesh(ctx, { box: { x: 0, y: 0, w: W, h: H }, alpha: 0.16 });

      if (A.logo) {
        var lw = 300, lh = lw * A.logo.naturalHeight / A.logo.naturalWidth;
        ctx.save(); ctx.shadowColor = C.cy; ctx.shadowBlur = 50;
        ctx.drawImage(A.logo, W / 2 - lw / 2, 150, lw, lh);
        ctx.restore();
      }

      txt(ctx, 'BRUNEL', { y: 480, size: 82, color: '#fff', glow: C.cy, glowSize: 42, track: 16 });
      txt(ctx, 'BLOCKCHAIN SOCIETY', { y: 556, size: 44, color: '#fff', track: 12 });
      txt(ctx, 'LEARN. BUILD. CONNECT.', { y: 618, size: 26, color: C.cy, track: 10 });

      /* what you get */
      var items = [
        ['WORKSHOPS', 'Hands-on, beginner first'],
        ['HACKATHONS', 'Build something real'],
        ['GUEST SPEAKERS', 'People doing the job'],
        ['PROJECTS', 'Ship it with a team'],
        ['NETWORKING', 'Meet the industry'],
        ['OPPORTUNITIES', 'Internships and referrals']
      ];
      items.forEach(function (it, i) {
        var col = i % 2, row = Math.floor(i / 2);
        var bw = 470, bh = 118;
        var x = W / 2 - bw - 16 + col * (bw + 32);
        var y = 700 + row * (bh + 20);
        ctx.save();
        ctx.fillStyle = 'rgba(10,17,28,.88)'; ctx.fillRect(x, y, bw, bh);
        ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(x, y, bw, bh);
        ctx.fillStyle = C.cy; ctx.fillRect(x, y, 5, bh);
        ctx.restore();
        txt(ctx, it[0], { x: x + 28, align: 'left', y: y + 44, size: 27, color: '#eafcff', track: 3.5, maxWidth: bw - 50 });
        txt(ctx, it[1], { x: x + 28, align: 'left', y: y + 82, size: 18, color: C.dim, track: 1.5, weight: 400, maxWidth: bw - 50 });
      });

      txt(ctx, 'AI · CYBERSECURITY · SOFTWARE', { y: 1142, size: 23, color: C.cy, track: 5 });
      txt(ctx, 'DATA · BLOCKCHAIN · WEB3', { y: 1178, size: 23, color: C.cy, track: 5 });

      txt(ctx, 'NO EXPERIENCE REQUIRED.', { y: 1232, size: 32, color: C.warn, track: 6 });

      qrPanel(ctx, A, { y: 1272, x: W / 2 - 87, size: 175, caption: 'SCAN TO JOIN', sub: 'MEMBERSHIP TAKES A MINUTE' });

      vignette(ctx, 0.5); grain(ctx); footer(ctx);
    }
  });

  /* ---- 4. LEARN BY PLAYING ------------------------------------ */
  POSTERS.push({
    id: 'learn', name: '4 — LEARN BY PLAYING',
    blurb: 'Teaches a real concept on the poster. For the curious ones.',
    draw: function (ctx, A) {
      background(ctx, { glowAt: [W / 2, 640], glowR: 700, glowColour: C.bad });
      brandMark(ctx, A, { size: 110, x: 90, y: 80 });

      txt(ctx, 'SPOT THE FRAUD', { y: 272, size: 68, color: '#fff', glow: C.bad, glowSize: 40, track: 9 });
      txt(ctx, 'ALICE HAS £60. SHE JUST SPENT £50 TWICE.', {
        y: 340, size: 24, color: C.dim, track: 3.5
      });

      txCard(ctx, {
        x: W / 2, y: 520, w: 640, h: 290, id: '4F08A1', from: 'ALICE', to: 'BOB', amount: 50, node: 2,
        cells: [['SENDER AVAIL', '£60', C.ok], ['NONCE', '27', C.warn], ['SIGNATURE', 'VALID', C.ok]]
      });
      txCard(ctx, {
        x: W / 2, y: 850, w: 640, h: 290, id: '9B2E77', from: 'ALICE', to: 'CHARLIE', amount: 50, node: 5,
        bad: true,
        cells: [['SENDER AVAIL', '£10', C.bad], ['NONCE', '27 USED', C.bad], ['SIGNATURE', 'VALID', C.ok]]
      });

      /* the link that proves they are the same money */
      ctx.save();
      ctx.strokeStyle = C.bad; ctx.lineWidth = 4; ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(W / 2 - 320, 520); ctx.lineTo(W / 2 - 390, 685); ctx.lineTo(W / 2 - 320, 850);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      txt(ctx, 'SAME', { x: W / 2 - 402, y: 668, size: 18, color: C.bad, track: 3, align: 'right' });
      txt(ctx, 'FUNDS', { x: W / 2 - 402, y: 700, size: 18, color: C.bad, track: 3, align: 'right' });

      txt(ctx, "THAT'S A DOUBLE SPEND.", { y: 1062, size: 43, color: C.bad, track: 7 });
      para(ctx, 'You just learned the thing blockchains were invented to stop. It took you four seconds. The game teaches five more.',
        { y: 1126, size: 24, color: C.dim, maxWidth: 880, lineHeight: 42 });

      qrPanel(ctx, A, { y: 1282, x: W / 2 - 87, size: 175, caption: 'PLAY IT AT OUR STALL', sub: false });

      vignette(ctx); grain(ctx); footer(ctx);
    }
  });

  /* ---- 5. THE INVITE ------------------------------------------ */
  POSTERS.push({
    id: 'invite', name: '5 — THE INVITE',
    blurb: 'Removes the barrier. For anyone who thinks it is not for them.',
    draw: function (ctx, A) {
      background(ctx, { gridAlpha: 0.04, glowAt: [W / 2, H * 0.62], glowR: 820 });
      // mesh kept to its own band so nothing has to be printed over it
      mesh(ctx, { box: { x: 120, y: 730, w: W - 240, h: 330 }, alpha: 0.85, labels: true, hostile: [3] });

      brandMark(ctx, A, { size: 110, x: 90, y: 80 });

      txt(ctx, "YOU DON'T NEED", { y: 320, size: 60, color: C.dim, track: 8 });
      txt(ctx, 'TO KNOW WHAT A', { y: 386, size: 60, color: C.dim, track: 8 });
      txt(ctx, 'BLOCKCHAIN IS.', { y: 452, size: 60, color: C.dim, track: 8 });

      ctx.save();
      ctx.strokeStyle = C.cy; ctx.lineWidth = 3; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(W / 2 - 180, 510); ctx.lineTo(W / 2 + 180, 510); ctx.stroke();
      ctx.restore();

      txt(ctx, 'YOU WILL IN', { y: 580, size: 62, color: '#fff', glow: C.cy, glowSize: 40, track: 10 });
      txt(ctx, '120 SECONDS.', { y: 655, size: 84, color: C.cy, glow: C.cy, glowSize: 50, track: 12 });

      txt(ctx, 'THEN COME BUILD WITH US.', { y: 1140, size: 33, color: C.warn, track: 6 });
      para(ctx, 'Play one round at our stall. Validate real transactions, catch a double spend, find a tampered block, and hold the network through a 51% attack.',
        { y: 1198, size: 23, color: C.dim, maxWidth: 880, lineHeight: 38 });

      qrPanel(ctx, A, { y: 1330, x: W / 2 - 80, size: 160, caption: 'SCAN TO JOIN', sub: false });

      vignette(ctx, 0.55); grain(ctx); footer(ctx);
    }
  });

  P.list = POSTERS;

  /**
   * Render one poster at any output size. Drawing happens in the 1200x1697
   * design space and the context is scaled, so print output is genuinely
   * sharp rather than an upscaled screen grab.
   */
  P.render = function (canvas, index, assets, outW) {
    var w = outW || W;
    var h = Math.round(w * H / W);
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(w / W, h / H);
    reseed();
    POSTERS[index].draw(ctx, assets || {});
    ctx.restore();
    return canvas;
  };
})(window);
