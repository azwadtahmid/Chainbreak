/* ============================================================
   CHAINBREAK — trailer/cut30.js
   The 30-second Reels / TikTok cut.

   This is not the long trailer with chunks deleted. It is a time
   REMAP of it: each segment below plays a slice of the 58s timeline
   at its own speed, so every shot is still drawn by the same code and
   stays visually identical — the pacing is what changes.

   Three beats are protected and play at (or near) natural speed,
   because they are the ones that sell the game:
     - the double spend        the clearest idea in the whole piece
     - the 51% attack          the climax
     - the title reveal        the call to action
   Everything else is compressed hard, which is what a Reel wants
   anyway: the hook has to land before a thumb moves.
   ============================================================ */
(function (root) {
  'use strict';

  var TR = root.TR;
  var Timeline = root.Timeline;

  var DURATION = 30;

  /* dst: [start, end] in the 30s cut
     src: [start, end] in the 58s original
     null src = hold on black                                   */
  var SEGMENTS = [
    { dst: [0.00, 3.40],  src: [0.80, 6.95] },    // opening, 1.8x
    { dst: [3.40, 3.55],  src: null },            // cut to black
    { dst: [3.55, 6.30],  src: [12.20, 15.00] },  // "THE NETWORK IS UNDER ATTACK."
    { dst: [6.30, 11.00], src: [19.30, 24.00] },  // ★ DOUBLE SPEND — natural speed
    { dst: [11.00, 14.30], src: [24.30, 30.60] }, // corruption + the audit, 1.9x
    { dst: [14.30, 18.00], src: [32.20, 40.00] }, // the network turns, 2.1x
    { dst: [18.00, 18.35], src: [40.00, 40.34] }, // the half-second of nothing
    { dst: [18.35, 25.60], src: [40.34, 50.00] }, // ★ 51% ATTACK — the climax
    { dst: [25.60, 26.10], src: null },           // silence
    { dst: [26.10, 30.00], src: [52.60, 58.00] }  // ★ TITLE REVEAL
  ];

  function mapTime(t) {
    for (var i = 0; i < SEGMENTS.length; i++) {
      var s = SEGMENTS[i];
      if (t >= s.dst[0] && t < s.dst[1]) {
        if (!s.src) return null;
        var p = (t - s.dst[0]) / (s.dst[1] - s.dst[0]);
        return s.src[0] + p * (s.src[1] - s.src[0]);
      }
    }
    return null;
  }

  /** Playback speed of the segment containing t — the drawing code needs
      dt scaled to match, or motion inside a shot runs at the wrong rate. */
  function rateAt(t) {
    for (var i = 0; i < SEGMENTS.length; i++) {
      var s = SEGMENTS[i];
      if (t >= s.dst[0] && t < s.dst[1] && s.src) {
        return (s.src[1] - s.src[0]) / (s.dst[1] - s.dst[0]);
      }
    }
    return 1;
  }

  root.Timeline30 = {
    DURATION: DURATION,
    segments: SEGMENTS,
    reset: function () { Timeline.reset(); },
    draw: function (ctx, t, dt) {
      var src = mapTime(t);
      if (src == null) { TR.clear(ctx, '#000'); return; }
      Timeline.draw(ctx, src, (dt || 0.016) * rateAt(t));
    },
    /** Exposed so the player can scrub correctly. */
    mapTime: mapTime
  };
})(window);
