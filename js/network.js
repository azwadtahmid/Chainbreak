/* ============================================================
   CHAINBREAK — network.js
   Live peer-to-peer visualisation: node mesh, animated links,
   transaction packets travelling toward the validator.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};
  var U = CB.util;

  // relative positions inside the network band
  var LAYOUT = [
    [0.11, 0.30], [0.30, 0.74], [0.51, 0.22], [0.72, 0.72], [0.90, 0.36]
  ];

  var COL = {
    link:    'rgba(0,229,255,',
    hostile: 'rgba(255,61,99,',
    ok:      'rgba(46,230,168,',
    warn:    'rgba(255,176,32,'
  };

  function Network() {
    this.canvas = null;
    this.ctx = null;
    this.layer = null;
    this.state = null;
    this.nodeEls = [];
    this.packets = [];
    this.sparks = [];
    this.t = 0;
    this.w = 0; this.h = 0; this.dpr = 1;
    this.turbulence = 0;
    this.onNodeClick = null;
    this.selectable = false;
  }

  Network.prototype.init = function (canvas, layer, state) {
    var self = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layer = layer;
    this.state = state;
    this.resize();
    this.buildNodes();
    // Safety net in case the pane was still settling when we measured.
    setTimeout(function () { self.resize(); self.placeNodes(); }, 60);
    if (!this._bound) {
      this._bound = true;
      root.addEventListener('resize', function () { self.resize(); self.placeNodes(); });
    }
  };

  Network.prototype.resize = function () {
    if (!this.canvas) return;
    var r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(root.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Network.prototype.buildNodes = function () {
    var self = this;
    U.clear(this.layer);
    this.nodeEls = [];
    this.state.nodes.forEach(function (n, i) {
      var pos = LAYOUT[i % LAYOUT.length];
      n.rx = pos[0]; n.ry = pos[1];

      var box = U.el('div', 'node');
      box.dataset.node = String(n.id);
      box.appendChild(U.el('i', 'n-dot'));
      box.appendChild(U.el('div', 'n-id', n.name));
      box.appendChild(U.el('div', 'n-status', 'SYNCED'));
      var rec = U.el('div', 'n-record');
      box.appendChild(rec);

      box.addEventListener('click', function () {
        if (self.selectable && self.onNodeClick) self.onNodeClick(n.id);
      });

      self.layer.appendChild(box);
      self.nodeEls.push(box);
    });
    this.placeNodes();
    this.syncNodes();
  };

  Network.prototype.placeNodes = function () {
    var self = this;
    this.state.nodes.forEach(function (n, i) {
      var e = self.nodeEls[i];
      if (!e) return;
      e.style.left = (n.rx * 100) + '%';
      e.style.top = (n.ry * 100) + '%';
      n.x = n.rx * self.w;
      n.y = n.ry * self.h;
    });
  };

  var STATUS_TEXT = {
    HONEST: 'SYNCED',
    SUSPECT: 'SUSPICIOUS',
    HOSTILE: 'HOSTILE',
    ISOLATED: 'ISOLATED'
  };

  /** Push node state into the DOM badges. */
  Network.prototype.syncNodes = function () {
    var self = this;
    this.state.nodes.forEach(function (n, i) {
      var e = self.nodeEls[i];
      if (!e) return;
      e.className = 'node'
        + (n.status === 'SUSPECT' ? ' suspect' : '')
        + (n.status === 'HOSTILE' ? ' hostile' : '')
        + (n.status === 'ISOLATED' ? ' isolated' : '')
        + (self.selectable && n.status !== 'ISOLATED' ? ' selectable' : '');
      e.querySelector('.n-status').textContent = STATUS_TEXT[n.status] || 'SYNCED';

      var rec = e.querySelector('.n-record');
      U.clear(rec);
      n.record.forEach(function (ok) {
        rec.appendChild(U.el('i', ok ? 'ok' : 'bad'));
      });
    });
  };

  Network.prototype.setSelectable = function (on, handler) {
    this.selectable = !!on;
    this.onNodeClick = handler || null;
    this.syncNodes();
  };

  Network.prototype.pulseNode = function (id) {
    var e = this.nodeEls[id];
    if (!e) return;
    e.classList.remove('pulse');
    void e.offsetWidth;
    e.classList.add('pulse');
  };

  /** A transaction leaving a peer and travelling to the validator. */
  Network.prototype.emitPacket = function (nodeId, kind) {
    var n = this.state.nodes[nodeId];
    if (!n) return;
    this.pulseNode(nodeId);
    this.packets.push({
      x: n.x, y: n.y,
      tx: this.w + 26, ty: this.h * 0.5,
      t: 0, dur: U.rand(0.75, 1.05),
      kind: kind || 'tx'
    });
  };

  /** A short burst at a node — isolation, rejection, consensus. */
  Network.prototype.burst = function (nodeId, kind) {
    var n = this.state.nodes[nodeId];
    if (!n) return;
    var count = U.reduceMotion ? 5 : 16;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = U.rand(40, 150);
      this.sparks.push({
        x: n.x, y: n.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, kind: kind || 'ok'
      });
    }
  };

  Network.prototype.shake = function (amount) {
    this.turbulence = Math.min(1, this.turbulence + (amount || 0.5));
  };

  Network.prototype.update = function (dt) {
    this.t += dt;
    this.turbulence = Math.max(0, this.turbulence - dt * 0.55);

    var i;
    for (i = this.packets.length - 1; i >= 0; i--) {
      var p = this.packets[i];
      p.t += dt / p.dur;
      if (p.t >= 1) this.packets.splice(i, 1);
    }
    for (i = this.sparks.length - 1; i >= 0; i--) {
      var s = this.sparks[i];
      s.life -= dt * 1.9;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.94; s.vy *= 0.94;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    this.state.nodes.forEach(function (n) {
      n.pulse = Math.max(0, n.pulse - dt * 2.2);
    });
  };

  Network.prototype.draw = function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var nodes = this.state.nodes;
    var i, j, a, b;

    ctx.clearRect(0, 0, this.w, this.h);

    var jitter = this.turbulence * 3;

    /* --- mesh links --- */
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      if (a.status === 'ISOLATED') continue;
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        if (b.status === 'ISOLATED') continue;

        var hostile = a.status === 'HOSTILE' || b.status === 'HOSTILE';
        var base = hostile ? COL.hostile : COL.link;
        var wave = 0.5 + 0.5 * Math.sin(this.t * 1.6 + (i * 3 + j) * 1.1);
        var alpha = (hostile ? 0.20 + wave * 0.38 : 0.08 + wave * 0.14);

        var ox = hostile ? U.rand(-jitter, jitter) : 0;
        var oy = hostile ? U.rand(-jitter, jitter) : 0;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x + ox, b.y + oy);
        ctx.strokeStyle = base + alpha.toFixed(3) + ')';
        ctx.lineWidth = hostile ? 1.4 : 1;
        ctx.stroke();

        /* data pip travelling along the link */
        if (!U.reduceMotion) {
          var phase = ((this.t * (hostile ? 0.85 : 0.42) + (i * 7 + j * 3) * 0.17) % 1);
          var px = U.lerp(a.x, b.x, phase);
          var py = U.lerp(a.y, b.y, phase);
          ctx.beginPath();
          ctx.arc(px, py, hostile ? 2.4 : 1.7, 0, Math.PI * 2);
          ctx.fillStyle = base + (hostile ? 0.9 : 0.5) + ')';
          ctx.fill();
        }
      }
    }

    /* --- glow halo under each node --- */
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      if (a.status === 'ISOLATED') continue;
      var pulseR = 26 + a.pulse * 22 + Math.sin(this.t * 2 + i) * 3;
      var col = a.status === 'HOSTILE' ? COL.hostile : (a.status === 'SUSPECT' ? COL.warn : COL.link);
      var g = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, pulseR);
      g.addColorStop(0, col + (0.26 + a.pulse * 0.3) + ')');
      g.addColorStop(1, col + '0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(a.x, a.y, pulseR, 0, Math.PI * 2);
      ctx.fill();
    }

    /* --- packets heading to the validator --- */
    for (i = 0; i < this.packets.length; i++) {
      var p = this.packets[i];
      var e = p.t * p.t * (3 - 2 * p.t);
      var x = U.lerp(p.x, p.tx, e);
      var y = U.lerp(p.y, p.ty, e) + Math.sin(p.t * Math.PI) * -16;
      var pc = p.kind === 'bad' ? COL.hostile : COL.link;
      var fade = 1 - Math.max(0, (p.t - 0.72) / 0.28);

      ctx.beginPath();
      ctx.moveTo(U.lerp(p.x, p.tx, Math.max(0, e - 0.06)), U.lerp(p.y, p.ty, Math.max(0, e - 0.06)));
      ctx.lineTo(x, y);
      ctx.strokeStyle = pc + (0.45 * fade) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = pc + fade + ')';
      ctx.fill();
    }

    /* --- sparks --- */
    for (i = 0; i < this.sparks.length; i++) {
      var s = this.sparks[i];
      var sc = s.kind === 'bad' ? COL.hostile : (s.kind === 'warn' ? COL.warn : COL.ok);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.2 * s.life, 0, Math.PI * 2);
      ctx.fillStyle = sc + Math.max(0, s.life).toFixed(2) + ')';
      ctx.fill();
    }
  };

  CB.Network = Network;

  /* ------------------------------------------------------------
     Ambient field for the start screen
     ------------------------------------------------------------ */
  CB.startField = function (canvas) {
    var ctx = canvas.getContext('2d');
    var pts = [], raf = 0, dpr = Math.min(root.devicePixelRatio || 1, 2);
    var w = 0, h = 0, stopped = false;

    function size() {
      var r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function build() {
      pts = [];
      var n = U.reduceMotion ? 18 : 42;
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: U.rand(-11, 11), vy: U.rand(-11, 11)
        });
      }
    }
    var last = 0;
    function frame(ts) {
      if (stopped) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      ctx.clearRect(0, 0, w, h);
      var i, j;
      for (i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      }
      for (i = 0; i < pts.length; i++) {
        for (j = i + 1; j < pts.length; j++) {
          var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 21000) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = 'rgba(0,229,255,' + (0.16 * (1 - d2 / 21000)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,229,255,.5)';
        ctx.fill();
      }
      raf = root.requestAnimationFrame(frame);
    }

    size(); build();
    raf = root.requestAnimationFrame(frame);
    root.addEventListener('resize', function () { size(); build(); });

    return { stop: function () { stopped = true; root.cancelAnimationFrame(raf); } };
  };
})(window);
