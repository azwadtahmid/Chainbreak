/* ============================================================
   CHAINBREAK — trailer/score.js
   An original score, synthesised in the browser.

   Nothing is sampled and nothing is licensed: every sound here is
   built from oscillators and shaped noise, so the trailer is free to
   post anywhere. The cue sheet at the bottom is the actual arrangement
   and it drives the timeline — the music escalates with the threat.
   ============================================================ */
(function (root) {
  'use strict';

  var Score = {};
  var ctx = null, master = null, dest = null;
  var started = false;

  Score.init = function () {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    // 0.62 not 0.9: on the biggest hits several instruments land on the same
    // sample and the sum was peaking above 0 dBFS, which clips. The loudness
    // comes back from the compressor below, without the distortion.
    master.gain.value = 0.62;

    // bus compression so the drops hit hard without clipping
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 7;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    master.connect(comp);
    comp.connect(ctx.destination);

    dest = ctx.createMediaStreamDestination();
    comp.connect(dest);
    return ctx;
  };

  Score.stream = function () { return dest ? dest.stream : null; };
  Score.context = function () { return ctx; };
  Score.setMuted = function (m) { if (master) master.gain.value = m ? 0 : 0.62; };

  /* ------------------------------------------------------------
     INSTRUMENTS
     ------------------------------------------------------------ */

  function env(node, at, peak, attack, decay, sustainLevel, holdFor) {
    var g = node.gain;
    g.setValueAtTime(0.0001, at);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    if (holdFor) {
      g.setValueAtTime(Math.max(0.0002, peak), at + attack + holdFor);
      g.exponentialRampToValueAtTime(Math.max(0.0001, sustainLevel || 0.0001), at + attack + holdFor + decay);
    } else {
      g.exponentialRampToValueAtTime(Math.max(0.0001, sustainLevel || 0.0001), at + attack + decay);
    }
  }

  function noiseBuffer(dur) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var b = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /** Deep sub-bass drone — the bed under the whole first act. */
  function drone(at, dur, freq, level) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    var f = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.value = freq;
    o2.type = 'sawtooth'; o2.frequency.value = freq * 1.007;   // slow beating
    f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 2;
    var g2 = ctx.createGain(); g2.gain.value = 0.22;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(f); f.connect(master);
    env(g, at, level, 1.2, 1.6, 0.0001, dur);
    o.start(at); o2.start(at);
    o.stop(at + dur + 3); o2.stop(at + dur + 3);
  }

  /** Cinematic sub hit — the bass impacts. */
  function boom(at, level, pitch) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch || 120, at);
    o.frequency.exponentialRampToValueAtTime(28, at + 0.55);
    env(g, at, level == null ? 1.0 : level, 0.006, 0.85);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + 1.1);

    // the air moving with it
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.5);
    var nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 180;
    var ng = ctx.createGain();
    env(ng, at, (level || 1) * 0.5, 0.004, 0.42);
    n.connect(nf); nf.connect(ng); ng.connect(master);
    n.start(at);
  }

  /** Kick. */
  function kick(at, level) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.11);
    env(g, at, level == null ? 0.85 : level, 0.003, 0.26);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + 0.4);
  }

  /** Tight industrial snare/clap. */
  function snare(at, level) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.26);
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    var g = ctx.createGain();
    env(g, at, level == null ? 0.5 : level, 0.002, 0.2);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(at);
  }

  /** The ticking clock of the opening. */
  function tick(at, level) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.05);
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 9;
    var g = ctx.createGain();
    env(g, at, level == null ? 0.3 : level, 0.001, 0.05);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(at);
  }

  /** Distant electronic pulse — the "something is out there" blip. */
  function blip(at, freq, level) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    var dly = ctx.createDelay(); dly.delayTime.value = 0.34;
    var fb = ctx.createGain(); fb.gain.value = 0.42;
    o.type = 'sine'; o.frequency.value = freq || 880;
    env(g, at, level == null ? 0.22 : level, 0.005, 0.22);
    o.connect(g); g.connect(master);
    g.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(master);
    o.start(at); o.stop(at + 0.5);
  }

  /** Orchestral-ish brass stab for the decision beats. */
  function stab(at, freq, level, dur) {
    var d = dur || 0.34;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    var g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'sawtooth'; o1.frequency.value = freq;
    o2.type = 'sawtooth'; o2.frequency.value = freq * 1.005;
    o3.type = 'square'; o3.frequency.value = freq * 0.5;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3400, at);
    f.frequency.exponentialRampToValueAtTime(700, at + d);
    f.Q.value = 5;
    env(g, at, level == null ? 0.42 : level, 0.008, d);
    o1.connect(f); o2.connect(f); o3.connect(f); f.connect(g); g.connect(master);
    [o1, o2, o3].forEach(function (o) { o.start(at); o.stop(at + d + 0.2); });
  }

  /** Rising tension sweep into a drop. */
  function riser(at, dur, level) {
    var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, at);
    o.frequency.exponentialRampToValueAtTime(1900, at + dur);
    f.type = 'bandpass'; f.Q.value = 7;
    f.frequency.setValueAtTime(300, at);
    f.frequency.exponentialRampToValueAtTime(4200, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level == null ? 0.34 : level, at + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.1);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(at); o.stop(at + dur + 0.2);

    // noise sweep riding with it
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(dur + 0.2);
    var nf = ctx.createBiquadFilter(); nf.type = 'highpass';
    nf.frequency.setValueAtTime(400, at);
    nf.frequency.exponentialRampToValueAtTime(7000, at + dur);
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, at);
    ng.gain.exponentialRampToValueAtTime((level || 0.34) * 0.5, at + dur * 0.92);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.1);
    n.connect(nf); nf.connect(ng); ng.connect(master);
    n.start(at);
  }

  /** Aggressive detuned bass for the attack section. */
  function bassline(at, dur, freq, level) {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    var g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'sawtooth'; o1.frequency.value = freq;
    o2.type = 'square'; o2.frequency.value = freq * 0.497;
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 8;
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 7.2; lg.gain.value = 420;
    lfo.connect(lg); lg.connect(f.frequency);
    env(g, at, level == null ? 0.4 : level, 0.02, 0.4, 0.0001, dur);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    [o1, o2, lfo].forEach(function (o) { o.start(at); o.stop(at + dur + 0.5); });
  }

  /** Shimmering high pad for the title. */
  function pad(at, dur, root_, level) {
    [0, 7, 12, 19].forEach(function (semi, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = root_ * Math.pow(2, semi / 12);
      env(g, at + i * 0.05, (level || 0.1) / (i + 1), 0.6, 1.4, 0.0001, dur);
      o.connect(g); g.connect(master);
      o.start(at); o.stop(at + dur + 2);
    });
  }

  /** Glitch burst for corruption moments. */
  function glitchNoise(at, level) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.16);
    var f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(3000, at);
    f.frequency.exponentialRampToValueAtTime(400, at + 0.15);
    f.Q.value = 14;
    var g = ctx.createGain();
    env(g, at, level == null ? 0.34 : level, 0.001, 0.15);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(at);
  }

  Score.instruments = {
    drone: drone, boom: boom, kick: kick, snare: snare, tick: tick,
    blip: blip, stab: stab, riser: riser, bassline: bassline, pad: pad,
    glitchNoise: glitchNoise
  };

  /* ------------------------------------------------------------
     THE ARRANGEMENT
     Times are trailer seconds. This is the cue sheet.
     ------------------------------------------------------------ */
  function arrange(t0) {
    var at = function (s) { return t0 + s; };
    var i;

    /* ---- 0-7  OPENING: near silence, a clock, something waking ---- */
    drone(at(0.2), 7.2, 34, 0.30);
    for (i = 0; i < 12; i++) tick(at(0.6 + i * 0.5), 0.16 + i * 0.012);
    blip(at(1.4), 1320, 0.13);
    blip(at(3.0), 990, 0.15);
    blip(at(4.6), 1320, 0.17);
    stab(at(2.05), 110, 0.16, 0.5);          // "ONE NETWORK."
    stab(at(3.75), 130, 0.19, 0.5);          // "ONE CHAIN."
    stab(at(5.45), 146, 0.24, 0.5);          // "ONE WEAK LINK."
    boom(at(6.75), 1.0, 150);                // hard bass hit -> black

    /* ---- 7-15  THE NETWORK: pulse establishes ---- */
    drone(at(7.1), 8.4, 41, 0.26);
    for (i = 0; i < 16; i++) kick(at(7.2 + i * 0.5), 0.34 + i * 0.012);
    for (i = 0; i < 8; i++) blip(at(7.4 + i * 1.0), i % 2 ? 880 : 1174, 0.11);
    stab(at(12.6), 164, 0.3, 0.7);           // "THE NETWORK IS UNDER ATTACK."
    boom(at(12.6), 0.5, 110);

    /* ---- 15-24  FIRST THREAT: percussion arrives ---- */
    drone(at(15.0), 9.2, 49, 0.24);
    for (i = 0; i < 36; i++) kick(at(15.0 + i * 0.25), i % 2 ? 0.3 : 0.5);
    for (i = 0; i < 18; i++) snare(at(15.5 + i * 0.5), 0.26);
    stab(at(16.2), 196, 0.38, 0.28);         // ACCEPT
    stab(at(17.9), 220, 0.38, 0.28);         // REJECT
    glitchNoise(at(19.4), 0.3);
    boom(at(19.4), 0.72, 130);               // DOUBLE SPEND DETECTED
    stab(at(19.5), 155, 0.42, 0.9);
    stab(at(22.3), 233, 0.44, 0.3);          // rejected / secured
    boom(at(22.3), 0.5, 120);

    /* ---- 24-32  THE CHAIN BREAKS: darker, detuned ---- */
    drone(at(24.0), 8.4, 46, 0.30);
    for (i = 0; i < 32; i++) kick(at(24.0 + i * 0.25), i % 4 === 0 ? 0.6 : 0.3);
    for (i = 0; i < 6; i++) glitchNoise(at(25.2 + i * 0.42), 0.22);
    boom(at(25.1), 0.8, 96);                 // CHAIN INTEGRITY FAILURE
    stab(at(25.15), 138, 0.4, 1.1);
    for (i = 0; i < 5; i++) stab(at(27.0 + i * 0.42), 175 + i * 22, 0.3, 0.2);  // HASH/RECALC/...
    boom(at(29.6), 0.62, 140);               // block isolated, chain restored
    glitchNoise(at(30.9), 0.42);
    boom(at(30.95), 0.7, 88);                // NODE 04 SUSPICIOUS
    stab(at(31.0), 116, 0.4, 0.8);

    /* ---- 32-40  THE NETWORK TURNS: build ---- */
    drone(at(32.0), 8.2, 55, 0.3);
    for (i = 0; i < 40; i++) kick(at(32.0 + i * 0.2), 0.42 + i * 0.006);
    for (i = 0; i < 20; i++) snare(at(32.2 + i * 0.4), 0.28 + i * 0.008);
    stab(at(32.6), 146, 0.38, 0.5);          // node turns
    stab(at(34.2), 164, 0.42, 0.5);
    stab(at(35.8), 185, 0.46, 0.5);
    boom(at(36.9), 0.6, 120);                // PEER ISOLATED
    stab(at(38.0), 207, 0.5, 0.6);           // and another turns
    riser(at(36.6), 3.3, 0.40);              // sweep into the drop
    // snare roll accelerating into 40s
    for (i = 0; i < 26; i++) {
      var f = i / 26;
      snare(at(36.8 + Math.pow(f, 1.7) * 3.1), 0.2 + f * 0.42);
    }

    /* ---- 40-50  51% ATTACK: the drop ---- */
    // half a second of near-nothing, then everything at once
    boom(at(40.35), 1.25, 180);
    glitchNoise(at(40.35), 0.6);
    stab(at(40.4), 87, 0.6, 1.6);
    drone(at(40.4), 9.6, 33, 0.40);
    for (i = 0; i < 40; i++) bassline(at(40.4 + i * 0.24), 0.22, i % 4 === 0 ? 58 : (i % 4 === 2 ? 69 : 65), 0.38);
    for (i = 0; i < 48; i++) kick(at(40.4 + i * 0.2), i % 2 === 0 ? 0.85 : 0.45);
    for (i = 0; i < 24; i++) snare(at(40.6 + i * 0.4), 0.42);
    boom(at(43.0), 0.75, 150);               // integrity 72%
    boom(at(45.0), 0.8, 140);                // 58%
    boom(at(47.0), 0.9, 130);                // 43%
    for (i = 0; i < 10; i++) glitchNoise(at(43.2 + i * 0.55), 0.2);
    riser(at(46.8), 2.6, 0.46);
    boom(at(49.4), 1.3, 200);                // final save
    stab(at(49.45), 98, 0.62, 1.4);

    /* ---- 50-58  TITLE: silence, then the reveal ---- */
    // 49.9-51.2 deliberately empty. Let it ring.
    for (i = 0; i < 6; i++) tick(at(51.3 + i * 0.13), 0.3);   // hash generating
    blip(at(52.2), 1320, 0.26);
    blip(at(52.7), 1568, 0.3);
    boom(at(53.2), 1.35, 190);               // CHAINBREAK lands
    pad(at(53.2), 5.0, 261.63, 0.13);
    stab(at(53.25), 65.4, 0.5, 2.4);
    drone(at(53.3), 4.8, 43, 0.26);
    boom(at(55.6), 0.5, 120);                // society line
    boom(at(57.0), 0.95, 150);               // final CTA hit
    stab(at(57.05), 98, 0.42, 1.2);
  }

  /* ------------------------------------------------------------
     THE 30-SECOND ARRANGEMENT (Reels / TikTok)
     Not the long score truncated — a separate cue sheet written to
     the short cut's beats, so the drop still lands on the 51% attack
     and the final impact still lands on the logotype.
     ------------------------------------------------------------ */
  function arrange30(t0) {
    var at = function (s) { return t0 + s; };
    var i;

    /* ---- 0-3.4  OPENING, compressed ---- */
    drone(at(0.1), 3.5, 34, 0.30);
    for (i = 0; i < 8; i++) tick(at(0.25 + i * 0.36), 0.18 + i * 0.02);
    blip(at(0.8), 1320, 0.14);
    stab(at(0.95), 110, 0.18, 0.4);         // ONE NETWORK.
    stab(at(1.85), 130, 0.22, 0.4);         // ONE CHAIN.
    stab(at(2.75), 146, 0.28, 0.4);         // ONE WEAK LINK.
    boom(at(3.32), 1.0, 150);

    /* ---- 3.55-6.3  THE NETWORK ---- */
    drone(at(3.6), 2.9, 44, 0.24);
    for (i = 0; i < 11; i++) kick(at(3.6 + i * 0.25), 0.4 + i * 0.02);
    stab(at(5.05), 164, 0.34, 0.6);         // UNDER ATTACK
    boom(at(5.05), 0.55, 115);

    /* ---- 6.3-11.0  DOUBLE SPEND (the hook) ---- */
    drone(at(6.3), 4.9, 49, 0.26);
    for (i = 0; i < 24; i++) kick(at(6.3 + i * 0.2), i % 2 ? 0.34 : 0.56);
    for (i = 0; i < 12; i++) snare(at(6.5 + i * 0.4), 0.3);
    glitchNoise(at(6.35), 0.32);
    boom(at(6.35), 0.78, 130);              // DOUBLE SPEND DETECTED
    stab(at(6.4), 155, 0.44, 0.9);
    stab(at(9.35), 233, 0.46, 0.3);         // REJECTED / SECURED
    boom(at(9.35), 0.55, 120);

    /* ---- 11.0-14.3  THE CHAIN BREAKS ---- */
    drone(at(11.0), 3.5, 46, 0.30);
    for (i = 0; i < 17; i++) kick(at(11.0 + i * 0.2), i % 4 === 0 ? 0.62 : 0.32);
    for (i = 0; i < 4; i++) glitchNoise(at(11.1 + i * 0.3), 0.24);
    boom(at(11.1), 0.8, 96);                // CHAIN INTEGRITY FAILURE
    stab(at(11.15), 138, 0.42, 1.0);
    for (i = 0; i < 4; i++) stab(at(12.1 + i * 0.28), 175 + i * 24, 0.3, 0.18);
    boom(at(13.5), 0.6, 140);               // isolated / restored

    /* ---- 14.3-18.0  THE NETWORK TURNS + build ---- */
    drone(at(14.3), 4.0, 55, 0.3);
    for (i = 0; i < 22; i++) kick(at(14.3 + i * 0.17), 0.44 + i * 0.01);
    stab(at(14.5), 146, 0.4, 0.4);
    stab(at(15.4), 168, 0.44, 0.4);
    stab(at(16.3), 190, 0.48, 0.4);
    boom(at(16.75), 0.6, 120);              // PEER ISOLATED
    riser(at(15.6), 2.6, 0.42);
    for (i = 0; i < 22; i++) {
      var f = i / 22;
      snare(at(15.7 + Math.pow(f, 1.7) * 2.5), 0.22 + f * 0.44);
    }

    /* ---- 18.35-25.6  THE DROP ---- */
    boom(at(18.35), 1.3, 180);
    glitchNoise(at(18.35), 0.6);
    stab(at(18.4), 87, 0.62, 1.5);
    drone(at(18.4), 7.3, 33, 0.40);
    for (i = 0; i < 32; i++) bassline(at(18.4 + i * 0.22), 0.2, i % 4 === 0 ? 58 : (i % 4 === 2 ? 69 : 65), 0.4);
    for (i = 0; i < 38; i++) kick(at(18.4 + i * 0.19), i % 2 === 0 ? 0.88 : 0.46);
    for (i = 0; i < 19; i++) snare(at(18.6 + i * 0.38), 0.44);
    boom(at(20.3), 0.75, 150);              // 72%
    boom(at(21.8), 0.82, 140);              // 58%
    boom(at(23.3), 0.9, 130);               // 43%
    for (i = 0; i < 8; i++) glitchNoise(at(20.4 + i * 0.5), 0.2);
    riser(at(23.3), 1.9, 0.46);
    boom(at(25.25), 1.3, 200);              // CHAIN HELD
    stab(at(25.3), 98, 0.62, 1.2);

    /* ---- 25.6-26.1 silence, then the logotype ---- */
    blip(at(25.95), 1568, 0.26);
    boom(at(26.2), 1.35, 190);              // CHAINBREAK
    pad(at(26.2), 3.8, 261.63, 0.14);
    stab(at(26.25), 65.4, 0.5, 2.0);
    drone(at(26.3), 3.6, 43, 0.26);
    boom(at(28.0), 0.5, 120);               // society line
    boom(at(29.15), 1.0, 150);              // final CTA hit
    stab(at(29.2), 98, 0.44, 1.0);
  }

  var t0 = 0;

  /**
   * Render the score to an AudioBuffer without playing it.
   *
   * OfflineAudioContext runs as fast as the CPU allows and does not depend
   * on the page being visible or on animation frames, so this is the
   * reliable way to get the music out — real-time capture stalls the moment
   * a browser decides the tab is in the background.
   */
  Score.renderOffline = function (variant, seconds, sampleRate) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error('OfflineAudioContext unavailable'));

    var sr = sampleRate || 48000;
    var off = new OAC(2, Math.ceil(seconds * sr), sr);

    // The instruments close over the module's ctx/master, so point those at
    // the offline graph for the duration of the render, then put them back.
    var realCtx = ctx, realMaster = master, realDest = dest;
    ctx = off;
    master = off.createGain();
    master.gain.value = 0.62;
    var comp = off.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 7;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    master.connect(comp); comp.connect(off.destination);
    dest = null;

    (variant === 'reel' ? arrange30 : arrange)(0.05);

    return off.startRendering().then(function (buf) {
      ctx = realCtx; master = realMaster; dest = realDest;

      // Safety net: scale to -1 dBFS if anything still peaks over. Writing a
      // buffer that exceeds +/-1 to 16-bit PCM hard-clips it audibly.
      var peak = 0, c, i, d;
      for (c = 0; c < buf.numberOfChannels; c++) {
        d = buf.getChannelData(c);
        for (i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; }
      }
      if (peak > 0.891) {
        var k = 0.891 / peak;
        for (c = 0; c < buf.numberOfChannels; c++) {
          d = buf.getChannelData(c);
          for (i = 0; i < d.length; i++) d[i] *= k;
        }
      }
      return buf;
    }, function (e) {
      ctx = realCtx; master = realMaster; dest = realDest;
      throw e;
    });
  };

  /** AudioBuffer -> 16-bit PCM WAV, so it can be written straight to disk. */
  Score.toWav = function (buf) {
    var chs = buf.numberOfChannels, len = buf.length;
    var data = new DataView(new ArrayBuffer(44 + len * chs * 2));
    var w = function (off, str) { for (var i = 0; i < str.length; i++) data.setUint8(off + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); data.setUint32(4, 36 + len * chs * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
    data.setUint16(22, chs, true); data.setUint32(24, buf.sampleRate, true);
    data.setUint32(28, buf.sampleRate * chs * 2, true);
    data.setUint16(32, chs * 2, true); data.setUint16(34, 16, true);
    w(36, 'data'); data.setUint32(40, len * chs * 2, true);

    var chans = [], c;
    for (c = 0; c < chs; c++) chans.push(buf.getChannelData(c));
    var off = 44;
    for (var i = 0; i < len; i++) {
      for (c = 0; c < chs; c++) {
        var s = Math.max(-1, Math.min(1, chans[c][i]));
        data.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return new Blob([data.buffer], { type: 'audio/wav' });
  };

  /**
   * Schedule the score. `variant` picks the cue sheet:
   * undefined / 'full' = the 58s trailer, 'reel' = the 30s cut.
   */
  Score.start = function (variant) {
    Score.init();
    if (ctx.state === 'suspended') ctx.resume();
    if (started) return t0;
    started = true;
    t0 = ctx.currentTime + 0.12;
    (variant === 'reel' ? arrange30 : arrange)(t0);
    return t0;
  };

  /** When trailer-second zero actually happens on the audio clock.
      The recorder uses this as its master time origin. */
  Score.startTime = function () { return t0; };

  Score.reset = function () {
    started = false; t0 = 0;
    if (ctx) { try { ctx.close(); } catch (e) {} }
    ctx = null; master = null; dest = null;
  };

  root.Score = Score;
})(window);
