/* ============================================================
   CHAINBREAK — audio.js
   All sound is synthesised in-browser with WebAudio.
   No external files, no network. Fails silently if unsupported.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};

  var ctx = null;
  var master = null;
  var muted = false;
  var supported = true;

  function init() {
    if (ctx || !supported) return;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) { supported = false; return; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
    } catch (e) { supported = false; }
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') { ctx.resume()['catch'](function () {}); }
  }

  /** One shaped oscillator note. */
  function tone(opt) {
    if (muted || !supported) return;
    init();
    if (!ctx) return;
    var t0 = ctx.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.12;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.from || 440, t0);
    if (opt.to && opt.to !== opt.from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + dur);
    }
    var vol = opt.vol == null ? 0.5 : opt.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** Filtered noise burst — used for glitch / attack textures. */
  function noise(opt) {
    if (muted || !supported) return;
    init();
    if (!ctx) return;
    var dur = opt.dur || 0.18;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0), i;
    for (i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = opt.filter || 'bandpass';
    f.frequency.value = opt.freq || 900;
    f.Q.value = opt.q || 1.2;
    var g = ctx.createGain();
    g.gain.value = opt.vol == null ? 0.3 : opt.vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(ctx.currentTime + (opt.delay || 0));
  }

  var sfx = {
    ui:       function () { tone({ type: 'triangle', from: 620, to: 780, dur: 0.06, vol: 0.28 }); },
    incoming: function () { tone({ type: 'sine', from: 900, to: 1200, dur: 0.05, vol: 0.14 }); },
    accept:   function () {
      tone({ type: 'triangle', from: 660, to: 880, dur: 0.09, vol: 0.4 });
      tone({ type: 'sine', from: 990, to: 1320, dur: 0.12, vol: 0.22, delay: 0.05 });
    },
    reject:   function () {
      tone({ type: 'square', from: 300, to: 150, dur: 0.11, vol: 0.28 });
      noise({ freq: 420, dur: 0.1, vol: 0.14 });
    },
    error:    function () {
      tone({ type: 'sawtooth', from: 220, to: 90, dur: 0.3, vol: 0.34 });
      noise({ freq: 260, dur: 0.26, vol: 0.2, filter: 'lowpass' });
    },
    block:    function () {
      tone({ type: 'triangle', from: 330, to: 330, dur: 0.1, vol: 0.32 });
      tone({ type: 'triangle', from: 440, to: 440, dur: 0.1, vol: 0.3, delay: 0.08 });
      tone({ type: 'triangle', from: 660, to: 880, dur: 0.24, vol: 0.34, delay: 0.16 });
    },
    warn:     function () {
      tone({ type: 'square', from: 740, to: 740, dur: 0.1, vol: 0.22 });
      tone({ type: 'square', from: 740, to: 740, dur: 0.1, vol: 0.22, delay: 0.18 });
    },
    attack:   function () {
      tone({ type: 'sawtooth', from: 120, to: 40, dur: 1.1, vol: 0.3 });
      noise({ freq: 180, dur: 0.9, vol: 0.18, filter: 'lowpass' });
      tone({ type: 'square', from: 880, to: 220, dur: 0.6, vol: 0.14, delay: 0.1 });
    },
    combo:    function (mult) {
      var base = 520 + mult * 110;
      tone({ type: 'triangle', from: base, to: base * 1.5, dur: 0.16, vol: 0.32 });
    },
    success:  function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ type: 'triangle', from: f, to: f, dur: 0.3, vol: 0.3, delay: i * 0.1 });
      });
    },
    fail:     function () {
      [392, 330, 262, 196].forEach(function (f, i) {
        tone({ type: 'sawtooth', from: f, to: f * 0.96, dur: 0.38, vol: 0.26, delay: i * 0.13 });
      });
    },
    tick:     function () { tone({ type: 'sine', from: 1400, to: 1400, dur: 0.03, vol: 0.12 }); }
  };

  CB.audio = {
    resume: resume,
    play: function (name, arg) { var f = sfx[name]; if (f) { try { f(arg); } catch (e) {} } },
    setMuted: function (m) { muted = !!m; if (!muted) resume(); },
    isMuted: function () { return muted; },
    toggle: function () { muted = !muted; if (!muted) resume(); return muted; }
  };
})(window);
