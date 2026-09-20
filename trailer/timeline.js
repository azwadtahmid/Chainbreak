/* ============================================================
   CHAINBREAK — trailer/timeline.js
   The shot list. 58 seconds, 9:16.

   Each scene owns a time range and a draw(ctx, t) where t is trailer
   time in seconds. Cuts are hard by default: a scene simply stops
   drawing and the next one starts. Black frames between beats are
   real gaps in the schedule, not fades.
   ============================================================ */
(function (root) {
  'use strict';

  var TR = root.TR, C = TR.C;
  var W = TR.W, H = TR.H;
  var span = TR.span, pulse = TR.pulse, easeOut = TR.easeOut, lerp = TR.lerp, clamp = TR.clamp;

  var DURATION = 58;

  /* Stable hashes for the chain, generated once from the real digest. */
  var HASHES = [];
  for (var i = 0; i < 12; i++) HASHES.push(TR.digest('CHAINBREAK|block|' + i));

  var NAMES = [['ALICE', 'BOB'], ['EMMA', 'LIAM'], ['RAVI', 'ZARA'], ['PRIYA', 'OMAR'], ['MAYA', 'FINN']];

  /* ------------------------------------------------------------
     helpers
     ------------------------------------------------------------ */

  /** Hard cut helper: true while t sits inside [a,b). */
  function on(t, a, b) { return t >= a && t < b; }

  /** Rapid-cut selector — returns which of n shots is showing. */
  function cutIndex(t, start, every, n) {
    return Math.floor((t - start) / every) % n;
  }

  /** Draw a horizontal run of chain blocks centred on the screen. */
  function chainRow(ctx, t, o) {
    var opt = o || {};
    var count = opt.count || 3;
    var bw = opt.bw || 300, gap = opt.gap || 74;
    var totalW = count * bw + (count - 1) * gap;
    var scrollX = opt.scroll || 0;
    var startX = W / 2 - totalW / 2 + bw / 2 - scrollX;
    var y = opt.y || H / 2;

    for (var k = 0; k < count; k++) {
      var x = startX + k * (bw + gap);
      if (x < -bw || x > W + bw) continue;

      if (k > 0) {
        TR.drawLink(ctx, x - bw / 2 - gap + 4, x - bw / 2 - 4, y, {
          alpha: opt.alpha, broken: opt.brokenAfter === k - 1
        });
      }
      var idx = (opt.firstIndex || 0) + k;
      TR.drawBlock(ctx, {
        x: x, y: y, w: bw, h: opt.bh || 340,
        index: idx,
        hash: HASHES[idx % HASHES.length],
        prev: idx === 0 ? '000000' : HASHES[(idx - 1) % HASHES.length],
        alpha: opt.alpha,
        state: opt.badIndex === k ? 'bad' : (opt.auditIndex === k ? 'audit' : 'ok'),
        recalc: opt.showRecalc ? (opt.badIndex === k ? TR.digest('tampered' + idx) : HASHES[idx % HASHES.length]) : null,
        glitchAmt: opt.badIndex === k ? (opt.glitchAmt || 0) : 0,
        txs: [
          [NAMES[idx % 5][0], NAMES[idx % 5][1], 30 + (idx * 17) % 90],
          [NAMES[(idx + 1) % 5][0], NAMES[(idx + 1) % 5][1], 20 + (idx * 29) % 70],
          [NAMES[(idx + 2) % 5][0], NAMES[(idx + 2) % 5][1], 45 + (idx * 13) % 60]
        ]
      });
    }
  }

  /* ------------------------------------------------------------
     SCENES
     ------------------------------------------------------------ */
  var scenes = [];

  /* ====== 0 - 7   OPENING ====================================== */
  scenes.push({
    a: 0, b: 7.0,
    draw: function (ctx, t, dt) {
      TR.clear(ctx);

      // faint digital pulse waking up
      var wake = span(t, 0.2, 2.2);
      TR.grid(ctx, 0.03 * wake, t * 6);
      TR.hexFieldDraw(ctx, t, dt, span(t, 0.3, 1.8) * 0.85);

      // nodes arrive one by one, then links form
      var appear = span(t, 1.2, 4.2);
      if (t > 1.2) {
        TR.drawMesh(ctx, t, dt, {
          appear: appear,
          linkAlpha: span(t, 2.4, 4.6) * 0.8,
          scale: lerp(1.18, 1.0, easeOut(span(t, 1.2, 6.0)))
        });
      }

      // blocks push in from the dark, one, then another, then another
      if (t > 3.4) {
        var n = Math.min(3, Math.floor((t - 3.4) / 0.62) + 1);
        var drift = (t - 3.4) * 26;
        ctx.save();
        ctx.globalAlpha = 1;
        chainRow(ctx, t, {
          count: n, firstIndex: 0, y: H * 0.68, bw: 252, bh: 300, gap: 56,
          alpha: span(t, 3.4, 4.2), scroll: -drift
        });
        ctx.restore();
      }

      // the three lines
      var lines = [
        { s: 1.9, e: 3.4, txt: 'ONE NETWORK.' },
        { s: 3.6, e: 5.1, txt: 'ONE CHAIN.' },
        { s: 5.3, e: 6.75, txt: 'ONE WEAK LINK.' }
      ];
      lines.forEach(function (L, idx) {
        if (t < L.s || t > L.e) return;
        var p = pulse(t, L.s, L.e, 0.14);
        var last = idx === 2;
        TR.text(ctx, L.txt, {
          y: H * 0.40, size: last ? 76 : 66,
          color: last ? C.bad : '#eafcff',
          glow: last ? C.bad : C.cy, glowSize: 46,
          alpha: p, track: last ? 16 : 13,
          jitter: last ? (1 - p) * 4 : 0
        });
      });

      // hard bass hit -> cut to black
      if (t > 6.72) {
        TR.flash(ctx, (1 - span(t, 6.72, 6.9)) * 0.9, '#ffffff');
        TR.glitch(ctx, (1 - span(t, 6.72, 7.0)) * 0.9);
      }

      TR.vignette(ctx, 0.85);
      TR.grain(ctx, 0.05);
    }
  });

  /* black frame */
  scenes.push({ a: 7.0, b: 7.22, draw: function (ctx) { TR.clear(ctx, '#000'); } });

  /* ====== 7.22 - 15   THE NETWORK ============================== */
  scenes.push({
    a: 7.22, b: 15.0,
    draw: function (ctx, t, dt) {
      TR.clear(ctx);
      TR.grid(ctx, 0.05, t * 14);

      var shot = cutIndex(t, 7.22, 1.55, 4);

      if (shot === 0) {
        // wide: the living mesh
        TR.drawMesh(ctx, t, dt, { labels: true, scale: lerp(1.0, 1.08, span(t, 7.22, 8.8)) });
      } else if (shot === 1) {
        // push-in on the chain growing
        var s = span(t, 8.77, 10.3);
        ctx.save();
        ctx.translate(W / 2, H / 2); ctx.scale(lerp(1.0, 1.26, easeOut(s)), lerp(1.0, 1.26, easeOut(s)));
        ctx.translate(-W / 2, -H / 2);
        chainRow(ctx, t, { count: 3, firstIndex: 1, y: H / 2, bw: 296, gap: 52, scroll: s * 34 });
        ctx.restore();
      } else if (shot === 2) {
        // close-up: a hash resolving
        var s2 = span(t, 10.32, 11.85);
        TR.drawBlock(ctx, {
          x: W / 2, y: H / 2, w: 760, h: 560, index: 4,
          hash: HASHES[4], prev: HASHES[3], hashGlow: true,
          txs: [['ALICE', 'BOB', 45], ['EMMA', 'LIAM', 30], ['RAVI', 'ZARA', 75]]
        });
        TR.text(ctx, 'HASH VERIFIED', {
          y: H / 2 + 360, size: 30, color: C.ok, track: 11, alpha: pulse(t, 11.0, 11.85, 0.3)
        });
      } else {
        // transactions crossing the mesh
        TR.drawMesh(ctx, t, dt, { labels: false, scale: 1.12, linkAlpha: 1.2 });
        TR.hexFieldDraw(ctx, t, dt, 0.35);
      }

      if (t > 12.5) {
        var p = pulse(t, 12.5, 14.95, 0.1);
        ctx.save();
        ctx.globalAlpha = p * 0.55;
        ctx.fillStyle = '#000'; ctx.fillRect(0, H * 0.40, W, 200);
        ctx.restore();
        TR.text(ctx, 'THE NETWORK', {
          y: H * 0.46, size: 62, color: '#eafcff', glow: C.cy, glowSize: 40, alpha: p, track: 13
        });
        TR.text(ctx, 'IS UNDER ATTACK.', {
          y: H * 0.52, size: 62, color: C.bad, glow: C.bad, glowSize: 40, alpha: p, track: 13
        });
      }

      TR.vignette(ctx, 0.8);
      TR.grain(ctx, 0.045);
    }
  });

  /* ====== 15 - 24   FIRST THREAT ============================== */
  scenes.push({
    a: 15.0, b: 24.0,
    draw: function (ctx, t, dt) {
      TR.clear(ctx);
      TR.grid(ctx, 0.04, t * 18);
      TR.drawMesh(ctx, t, dt, { linkAlpha: 0.35, scale: 1.3 });

      // a valid one -> ACCEPT
      if (on(t, 15.0, 17.0)) {
        var a1 = span(t, 15.0, 15.25);
        TR.drawTxCard(ctx, {
          x: W / 2, y: H * 0.46, id: 'A93F21', from: 'ALICE', to: 'BOB', amount: 45, node: 2,
          alpha: a1,
          cells: [['SENDER AVAIL', '£120', C.ok], ['NONCE', '07', C.txt], ['SIGNATURE', 'VALID', C.ok]]
        });
        if (t > 16.15) {
          var sp = span(t, 16.15, 16.45);
          TR.stamp(ctx, 'ACCEPT', C.ok, {
            y: H * 0.72, alpha: pulse(t, 16.15, 17.0, 0.18), scale: lerp(1.35, 1.0, easeOut(sp))
          });
        }
      }

      // a forged one -> REJECT
      if (on(t, 17.05, 19.3)) {
        var a2 = span(t, 17.05, 17.3);
        TR.drawTxCard(ctx, {
          x: W / 2, y: H * 0.46, id: 'C71B04', from: 'EMMA', to: 'LIAM', amount: 210, node: 4,
          alpha: a2, verdict: 'bad',
          cells: [['SENDER AVAIL', '£85', C.bad], ['NONCE', '13', C.txt], ['SIGNATURE', 'FORGED', C.bad]]
        });
        if (t > 17.85) {
          var sp2 = span(t, 17.85, 18.15);
          TR.stamp(ctx, 'REJECT', C.bad, {
            y: H * 0.72, alpha: pulse(t, 17.85, 19.3, 0.14), scale: lerp(1.35, 1.0, easeOut(sp2))
          });
        }
      }

      // DOUBLE SPEND — two cards, same funds
      if (on(t, 19.35, 22.3)) {
        var ap = span(t, 19.35, 19.6);
        TR.banner(ctx, '⚠ DOUBLE SPEND DETECTED', C.bad, {
          y: H * 0.20, size: 36, alpha: ap
        });

        var shake = t < 19.8 ? (19.8 - t) * 40 : 0;
        TR.drawTxCard(ctx, {
          x: W / 2, y: H * 0.42, w: 660, h: 340, id: '4F08A1', from: 'ALICE', to: 'BOB', amount: 50, node: 2,
          alpha: ap, shake: shake,
          cells: [['SENDER AVAIL', '£60', C.ok], ['NONCE', '27', C.warn], ['SIGNATURE', 'VALID', C.ok]]
        });
        TR.drawTxCard(ctx, {
          x: W / 2, y: H * 0.68, w: 660, h: 340, id: '9B2E77', from: 'ALICE', to: 'CHARLIE', amount: 50, node: 5,
          alpha: ap, verdict: 'bad', shake: shake,
          cells: [['SENDER AVAIL', '£10', C.bad], ['NONCE', '27 USED', C.bad], ['SIGNATURE', 'VALID', C.ok]]
        });

        // the link that proves they are the same money
        ctx.save();
        ctx.globalAlpha = ap * (0.6 + 0.4 * Math.sin(t * 14));
        ctx.strokeStyle = C.bad; ctx.lineWidth = 4; ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.moveTo(W / 2 - 340, H * 0.42); ctx.lineTo(W / 2 - 400, H * 0.55); ctx.lineTo(W / 2 - 340, H * 0.68);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
        TR.text(ctx, 'SAME FUNDS', {
          x: W / 2 - 400, y: H * 0.55, size: 20, color: C.bad, alpha: ap, track: 4
        });

        if (t > 21.4) {
          TR.flash(ctx, pulse(t, 21.4, 21.6, 0.3) * 0.25, C.bad);
        }
      }

      // rejected, network secured
      if (on(t, 22.35, 24.0)) {
        var pp = span(t, 22.35, 22.6);
        TR.stamp(ctx, 'REJECTED', C.ok, {
          y: H * 0.38, alpha: pp, scale: lerp(1.3, 1.0, easeOut(pp))
        });
        TR.text(ctx, 'NETWORK SECURED', {
          y: H * 0.50, size: 34, color: C.ok, track: 11, alpha: pp, glow: C.ok, glowSize: 24
        });
        TR.integrity(ctx, 94, { y: H * 0.62, alpha: pp });
      }

      TR.vignette(ctx, 0.78);
      TR.grain(ctx, 0.05);
    }
  });

  /* black frame */
  scenes.push({ a: 24.0, b: 24.16, draw: function (ctx) { TR.clear(ctx, '#000'); } });

  /* ====== 24.16 - 32   THE CHAIN BREAKS ======================= */
  scenes.push({
    a: 24.16, b: 32.0,
    draw: function (ctx, t, dt) {
      TR.clear(ctx);
      TR.grid(ctx, 0.035, t * 10);

      // zoom into a block's hash as it starts to glitch
      if (on(t, 24.16, 26.4)) {
        var z = span(t, 24.16, 26.4);
        var g = span(t, 25.0, 26.4);
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(lerp(1.0, 1.32, easeOut(z)), lerp(1.0, 1.32, easeOut(z)));
        ctx.translate(-W / 2, -H / 2);
        TR.drawBlock(ctx, {
          x: W / 2, y: H / 2, w: 620, h: 470, index: 3,
          hash: g > 0.25 ? TR.randomHex(6) : HASHES[3],
          prev: HASHES[2], state: g > 0.2 ? 'bad' : 'ok',
          glitchAmt: g, hashGlow: true,
          txs: [['ALICE', 'BOB', 45], ['EMMA', 'LIAM', g > 0.4 ? 999 : 30], ['RAVI', 'ZARA', 75]]
        });
        ctx.restore();
        TR.glitch(ctx, g * 0.55);
        if (t > 25.05) {
          TR.banner(ctx, 'CHAIN INTEGRITY FAILURE', C.bad, {
            y: H * 0.16, size: 38, alpha: pulse(t, 25.05, 26.4, 0.12)
          });
        }
      }

      // rapid cuts: HASH / RECALC / BLOCK / NETWORK / WARNING
      if (on(t, 26.45, 28.9)) {
        var words = ['HASH', 'RECALC', 'BLOCK', 'NETWORK', 'WARNING'];
        var cols = [C.cy, C.warn, C.violet, C.cy, C.bad];
        var k = cutIndex(t, 26.45, 0.42, 5);
        TR.drawMesh(ctx, t, dt, { linkAlpha: 0.22, scale: 1.5 });
        TR.text(ctx, words[k], {
          y: H * 0.46, size: 104, color: cols[k], glow: cols[k], glowSize: 54, track: 22,
          jitter: 3
        });
        TR.text(ctx, TR.randomHex(6), {
          y: H * 0.56, size: 44, color: C.faint, track: 12
        });
        TR.glitch(ctx, 0.2);
      }

      // the audit: find the block whose recalc disagrees
      if (on(t, 28.95, 30.7)) {
        var ap = span(t, 28.95, 29.2);
        chainRow(ctx, t, {
          count: 3, firstIndex: 2, y: H * 0.46, bw: 290, bh: 400, gap: 48,
          alpha: ap, showRecalc: true, badIndex: 1,
          glitchAmt: t < 29.6 ? 0.5 : 0, brokenAfter: t < 29.6 ? 1 : -1
        });
        if (t > 29.6) {
          TR.stamp(ctx, 'ISOLATED', C.ok, { y: H * 0.72, alpha: pulse(t, 29.6, 30.7, 0.2), size: 62 });
          TR.text(ctx, 'CHAIN RESTORED', {
            y: H * 0.80, size: 30, color: C.ok, track: 10, alpha: pulse(t, 29.7, 30.7, 0.2)
          });
        }
      }

      // glitch -> a node goes suspicious
      if (on(t, 30.75, 32.0)) {
        TR.setNodeState(3, 'suspect');
        TR.drawMesh(ctx, t, dt, { labels: true, scale: 1.15, turbulence: 0.5 });
        var sp = span(t, 30.9, 31.2);
        TR.banner(ctx, 'NODE 04  ·  SUSPICIOUS', C.warn, {
          y: H * 0.18, size: 38, alpha: sp
        });
        TR.glitch(ctx, (1 - span(t, 30.75, 31.1)) * 0.7);
      }

      TR.vignette(ctx, 0.8);
      TR.grain(ctx, 0.06);
    }
  });

  /* ====== 32 - 40   THE NETWORK TURNS ========================= */
  scenes.push({
    a: 32.0, b: 40.0,
    draw: function (ctx, t, dt) {
      TR.clear(ctx);
      TR.grid(ctx, 0.04, t * 22);

      // nodes flip hostile one at a time
      if (t > 32.5) TR.setNodeState(3, 'hostile');
      if (t > 34.1) TR.setNodeState(1, 'hostile');
      if (t > 35.7) TR.setNodeState(4, 'hostile');
      if (t > 36.85) TR.setNodeState(3, 'isolated');
      if (t > 37.95) TR.setNodeState(0, 'hostile');

      var turb = span(t, 32.0, 39.0);
      TR.drawMesh(ctx, t, dt, {
        labels: true, scale: lerp(1.05, 1.22, turb), turbulence: turb
      });

      // broadcast record strip
      if (on(t, 33.2, 36.6)) {
        var rp = span(t, 33.2, 33.5);
        ctx.save();
        ctx.globalAlpha = rp * 0.9;
        var bx = W / 2 - 330, by = H * 0.80;
        ctx.fillStyle = 'rgba(8,14,23,.92)';
        ctx.fillRect(bx, by, 660, 120);
        ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 660, 120);
        TR.text(ctx, 'BROADCAST RECORD', { x: W / 2, y: by + 30, size: 18, color: C.faint, track: 6 });
        ctx.restore();
        for (var n = 0; n < 5; n++) {
          var bad = (n === 3);
          for (var s = 0; s < 5; s++) {
            var okDot = !(bad && s > 1);
            ctx.save();
            ctx.globalAlpha = rp;
            ctx.fillStyle = okDot ? C.ok : C.bad;
            ctx.shadowColor = okDot ? C.ok : C.bad; ctx.shadowBlur = 10;
            ctx.fillRect(bx + 60 + n * 120 + s * 16, by + 62, 11, 11);
            ctx.restore();
          }
          TR.text(ctx, '0' + (n + 1), {
            x: bx + 60 + n * 120 + 34, y: by + 96, size: 15, color: C.faint, alpha: rp, track: 2
          });
        }
      }

      if (on(t, 36.9, 38.0)) {
        TR.stamp(ctx, 'PEER ISOLATED', C.ok, {
          y: H * 0.30, alpha: pulse(t, 36.9, 38.0, 0.16), size: 56
        });
      }
      if (on(t, 38.0, 39.0)) {
        TR.banner(ctx, 'ANOTHER NODE TURNS', C.bad, {
          y: H * 0.30, size: 34, alpha: pulse(t, 38.0, 39.0, 0.2)
        });
      }

      // the line, then near-silence
      if (t > 38.9) {
        var lp = pulse(t, 38.9, 40.0, 0.18);
        ctx.save(); ctx.globalAlpha = lp * 0.72;
        ctx.fillStyle = '#000'; ctx.fillRect(0, H * 0.42, W, 180);
        ctx.restore();
        TR.text(ctx, "YOU CAN'T TRUST", {
          y: H * 0.46, size: 58, color: '#eafcff', glow: C.bad, glowSize: 34, alpha: lp, track: 12
        });
        TR.text(ctx, 'EVERY NODE.', {
          y: H * 0.52, size: 58, color: C.bad, glow: C.bad, glowSize: 34, alpha: lp, track: 12
        });
      }

      TR.vignette(ctx, 0.82);
      TR.grain(ctx, 0.055);
    }
  });

  /* the half-second of almost nothing before the drop */
  scenes.push({
    a: 40.0, b: 40.34,
    draw: function (ctx, t) {
      TR.clear(ctx, '#000');
      TR.text(ctx, TR.randomHex(6), {
        y: H / 2, size: 30, color: C.faint, alpha: 0.35, track: 10
      });
    }
  });

  /* ====== 40.34 - 50   51% ATTACK ============================= */
  scenes.push({
    a: 40.34, b: 50.0,
    draw: function (ctx, t, dt) {
      TR.clear(ctx);

      var hit = span(t, 40.34, 40.62);
      TR.grid(ctx, 0.07, t * 40);

      // everything hostile
      TR.setNodeState(0, 'hostile'); TR.setNodeState(1, 'hostile');
      TR.setNodeState(4, 'hostile');
      if (t > 44.0) TR.setNodeState(2, 'hostile');
      if (t > 47.6) { TR.setNodeState(1, 'isolated'); TR.setNodeState(4, 'isolated'); }

      TR.drawMesh(ctx, t, dt, {
        labels: t < 44, scale: lerp(1.45, 1.12, easeOut(span(t, 40.34, 42.5))),
        turbulence: 1
      });

      // the title card of the climax
      if (on(t, 40.34, 42.6)) {
        var cp = pulse(t, 40.34, 42.6, 0.06);
        TR.flash(ctx, (1 - hit) * 0.6, '#ffffff');
        TR.text(ctx, 'CRITICAL THREAT', {
          y: H * 0.38, size: 44, color: C.bad, track: 14, alpha: cp
        });
        TR.text(ctx, '51% ATTACK', {
          y: H * 0.46, size: 96, color: '#fff', glow: C.bad, glowSize: 58, track: 20, alpha: cp
        });
        TR.text(ctx, 'DETECTED', {
          y: H * 0.535, size: 96, color: '#fff', glow: C.bad, glowSize: 58, track: 20, alpha: cp
        });
      }

      // the node count flipping
      if (on(t, 42.7, 45.6)) {
        var flipped = t > 44.0;
        var np = span(t, 42.7, 42.9);
        ctx.save();
        ctx.globalAlpha = np * 0.85;
        ctx.fillStyle = 'rgba(4,7,12,.86)';
        ctx.fillRect(W / 2 - 380, H * 0.295, 760, 230);
        ctx.strokeStyle = flipped ? C.bad : C.line; ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - 380, H * 0.295, 760, 230);
        ctx.restore();
        TR.text(ctx, 'HONEST NODES: ' + (flipped ? 2 : 3), {
          y: H * 0.338, size: 36, color: flipped ? C.dim : C.ok, track: 8, alpha: np,
          maxWidth: 680
        });
        TR.text(ctx, 'MALICIOUS NODES: ' + (flipped ? 3 : 2), {
          y: H * 0.392, size: 36, color: C.bad, track: 8, alpha: np,
          glow: flipped ? C.bad : null, glowSize: 26, maxWidth: 680
        });
        if (flipped) {
          TR.text(ctx, 'MAJORITY LOST', {
            y: H * 0.452, size: 28, color: C.bad, track: 10, maxWidth: 680,
            alpha: 0.6 + 0.4 * Math.sin(t * 16)
          });
        }
      }

      // the chain forks into two competing branches
      if (t > 44.2) {
        var fp = span(t, 44.2, 45.4);
        var splitY = H * 0.70;
        var spread = 132 * easeOut(fp);
        ctx.save();
        ctx.globalAlpha = fp;
        // honest branch
        TR.drawBlock(ctx, {
          x: W * 0.40, y: splitY - spread, w: 240, h: 230, index: 8,
          hash: HASHES[8], prev: HASHES[7], state: 'ok',
          txs: [['ALICE', 'BOB', 45], ['EMMA', 'LIAM', 30]]
        });
        // attacker branch
        TR.drawBlock(ctx, {
          x: W * 0.40, y: splitY + spread, w: 240, h: 230, index: 8,
          hash: TR.randomHex(6), prev: HASHES[7], state: 'bad',
          glitchAmt: 0.4,
          txs: [['MALLORY', 'MALLORY', 900], ['MALLORY', 'MALLORY', 900]]
        });
        ctx.strokeStyle = C.cy; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(W * 0.40 - 160, splitY);
        ctx.lineTo(W * 0.40 - 124, splitY - spread);
        ctx.moveTo(W * 0.40 - 160, splitY);
        ctx.lineTo(W * 0.40 - 124, splitY + spread);
        ctx.stroke();
        TR.text(ctx, 'FORK', { x: W * 0.40 - 205, y: splitY, size: 22, color: C.warn, track: 5, alpha: fp });
        ctx.restore();
      }

      // the player fighting back — rapid action labels
      if (on(t, 45.7, 49.3)) {
        var acts = ['REJECT', 'ISOLATE', 'AUDIT', 'PROTECT'];
        var colsA = [C.bad, C.warn, C.violet, C.ok];
        var ai = cutIndex(t, 45.7, 0.3, 4);
        TR.text(ctx, acts[ai], {
          y: H * 0.20, size: 66, color: colsA[ai], glow: colsA[ai], glowSize: 40, track: 15,
          jitter: 2
        });
      }

      // integrity falling
      if (t > 43.0) {
        var iv = t < 45.0 ? 72 : (t < 47.0 ? 58 : (t < 49.3 ? 43 : 43));
        TR.integrity(ctx, iv, { y: H * 0.88, alpha: 0.95 });
      }

      // the save
      if (t > 49.3) {
        var sv = span(t, 49.3, 49.5);
        TR.flash(ctx, (1 - sv) * 0.5, '#ffffff');
        TR.text(ctx, 'CHAIN HELD.', {
          y: H * 0.46, size: 76, color: C.ok, glow: C.ok, glowSize: 54, track: 16,
          alpha: pulse(t, 49.35, 50.0, 0.2)
        });
      }

      // occasional stabs rather than a permanent smear
      var gl = t < 49.25 ? Math.max(0, Math.sin(t * 5.5)) * 0.22 : 0;
      TR.glitch(ctx, gl);
      TR.scanlines(ctx, 0.03);
      TR.vignette(ctx, 0.72);
      TR.grain(ctx, 0.05);
    }
  });

  /* silence — everything stops */
  scenes.push({ a: 50.0, b: 51.2, draw: function (ctx) { TR.clear(ctx, '#000'); } });

  /* ====== 51.2 - 58   TITLE REVEAL ============================ */
  scenes.push({
    a: 51.2, b: DURATION,
    draw: function (ctx, t, dt) {
      TR.clear(ctx, '#000');

      // one block, its hash generating character by character
      if (t < 53.2) {
        var reveal = span(t, 51.35, 52.3);
        var chars = Math.ceil(reveal * 6);
        var h = HASHES[0].slice(0, chars) + TR.randomHex(6 - chars);
        TR.drawBlock(ctx, {
          x: W / 2, y: H * 0.44, w: 420, h: 300, index: 0,
          hash: h, prev: '000000', hashGlow: true,
          alpha: span(t, 51.25, 51.5),
          txs: [['ALICE', 'BOB', 45], ['EMMA', 'LIAM', 30]]
        });
        // then it connects, and connects again
        if (t > 52.35) {
          var cp2 = span(t, 52.35, 53.15);
          ctx.save();
          ctx.globalAlpha = cp2;
          TR.drawLink(ctx, W / 2 + 214, W / 2 + 290, H * 0.44, {});
          TR.drawBlock(ctx, {
            x: W / 2 + 430, y: H * 0.44, w: 420, h: 300, index: 1,
            hash: HASHES[1], prev: HASHES[0],
            txs: [['RAVI', 'ZARA', 75], ['MAYA', 'FINN', 60]]
          });
          ctx.restore();
        }
      }

      // the whole chain lights up, then the title lands
      if (t >= 53.0) {
        var burst = span(t, 53.0, 53.2);
        TR.flash(ctx, (1 - burst) * 0.55, '#ffffff');

        // The chain glows in a band ACROSS THE TOP only — behind the
        // logotype it would fight every line of type underneath it.
        ctx.save();
        ctx.globalAlpha = 0.16 * span(t, 53.2, 54.2);
        chainRow(ctx, t, { count: 4, firstIndex: 0, y: H * 0.155, bw: 210, bh: 230, gap: 34 });
        ctx.restore();

        var tp = span(t, 53.15, 53.8);
        TR.text(ctx, 'CHAINBREAK', {
          y: H * 0.36, size: lerp(112, 96, easeOut(tp)), color: '#ffffff',
          glow: C.cy, glowSize: 72, track: lerp(22, 14, easeOut(tp)),
          alpha: span(t, 53.15, 53.4), maxWidth: W - 110
        });

        var sp = span(t, 53.9, 54.4);
        TR.text(ctx, 'DEFEND THE NETWORK.', {
          y: H * 0.435, size: 33, color: C.cy, track: 9, alpha: sp, maxWidth: W - 150
        });
        TR.text(ctx, 'PROTECT THE CHAIN.', {
          y: H * 0.478, size: 33, color: C.cy, track: 9, alpha: sp, maxWidth: W - 150
        });

        // hairline rule separating the game from the society
        ctx.save();
        ctx.globalAlpha = span(t, 55.2, 55.7) * 0.5;
        ctx.strokeStyle = C.line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W * 0.25, H * 0.545); ctx.lineTo(W * 0.75, H * 0.545); ctx.stroke();
        ctx.restore();

        var bp = span(t, 55.5, 56.0);
        TR.text(ctx, 'BRUNEL BLOCKCHAIN SOCIETY', {
          y: H * 0.60, size: 28, color: '#eafcff', track: 7, alpha: bp, maxWidth: W - 150
        });
        TR.text(ctx, 'LEARN. BUILD. CONNECT.', {
          y: H * 0.645, size: 20, color: C.dim, track: 8, alpha: bp, maxWidth: W - 200
        });

        var cp3 = span(t, 56.9, 57.3);
        if (t > 56.9) {
          // a brief rim pulse, not a full-screen colour wash
          TR.flash(ctx, pulse(t, 56.9, 57.15, 0.3) * 0.10, C.cy);
          TR.text(ctx, 'CAN YOU KEEP', {
            y: H * 0.755, size: 44, color: '#fff', glow: C.cy, glowSize: 36, track: 10,
            alpha: cp3, maxWidth: W - 150
          });
          TR.text(ctx, 'THE CHAIN ALIVE?', {
            y: H * 0.808, size: 44, color: '#fff', glow: C.cy, glowSize: 36, track: 10,
            alpha: cp3, maxWidth: W - 150
          });
          TR.text(ctx, 'PLAY IT AT FRESHERS WEEK.', {
            y: H * 0.885, size: 22, color: C.warn, track: 7,
            alpha: span(t, 57.25, 57.6), maxWidth: W - 200
          });
        }
      }

      TR.vignette(ctx, 0.62);
      TR.grain(ctx, 0.04);
    }
  });

  root.Timeline = {
    DURATION: DURATION,
    scenes: scenes,
    reset: function () {
      TR.reseed(1337);
      TR.initNodes();
      TR.initHexField(110);
      TR.resetNodes();
    },
    draw: function (ctx, t, dt) {
      for (var i = 0; i < scenes.length; i++) {
        var s = scenes[i];
        if (t >= s.a && t < s.b) { s.draw(ctx, t, dt); return; }
      }
      TR.clear(ctx, '#000');
    }
  };
})(window);
