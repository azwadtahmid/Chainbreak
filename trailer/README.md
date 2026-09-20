# CHAINBREAK — Trailer

A 58-second cinematic trailer in **9:16 vertical** (1080×1920), built for Instagram
Reels and TikTok.

Open **`trailer/index.html`** and press PLAY. Sound is on by default — the first
click is what lets the browser start audio.

---

## Why it is code and not an AI video

The brief asked for something that looks like the game and explicitly *not* like a
generic AI trailer. So none of this is generated footage: it is drawn live with the
game's own palette, typography, block layout and node mesh, using the same hash
function the game uses. Every hash on screen is real — `BLOCK 02`'s `PREV` genuinely
equals `BLOCK 01`'s `HASH`, and the tampered block's `RECALC` genuinely differs from
its stored `HASH`, because both are computed, not typed in.

It is also deterministic: the random seed is fixed, so every render is identical.
Re-record it a year from now and you get the same film.

---

## The score

Original, synthesised in the browser from oscillators and shaped noise. Nothing is
sampled and nothing is licensed, so it is safe to post anywhere. The arrangement is
in `score.js` and is structured as a real cue sheet:

| Time | Music |
|------|-------|
| 0–7s | 34 Hz sub drone, a ticking clock accelerating, distant delayed blips |
| 7–15s | Pulse establishes, kick every half second |
| 15–24s | Percussion arrives, brass stabs land on every ACCEPT / REJECT |
| 24–32s | Darker, detuned; glitch bursts on the corruption |
| 32–40s | Building — snare roll accelerating, riser sweeping up |
| **40s** | **The drop.** Sub impact, aggressive detuned bassline, everything at once |
| 40–50s | Maximum intensity, impacts on each integrity drop |
| 50–51.2s | Deliberate silence |
| 51.2–58s | Hash ticks, then the title impact and a shimmering pad |

---

## Shot list

| Time | Beat |
|------|------|
| 0–7s | Hex fragments in darkness → nodes appear → chain forms. "ONE NETWORK. / ONE CHAIN. / ONE WEAK LINK." → bass hit → black |
| 7–15s | The living network: mesh, chain growing, a hash verifying. "THE NETWORK IS UNDER ATTACK." |
| 15–24s | ACCEPT a valid payment → REJECT a forged one → **DOUBLE SPEND DETECTED**, the same £50 promised twice → REJECTED, integrity 94% |
| 24–32s | Zoom into a hash as it corrupts → CHAIN INTEGRITY FAILURE → rapid HASH/RECALC/BLOCK/NETWORK/WARNING cuts → the audit finds the block → NODE 04 SUSPICIOUS |
| 32–40s | Nodes turn hostile one by one, broadcast records expose the liar, PEER ISOLATED — then another turns. "YOU CAN'T TRUST EVERY NODE." |
| 40–50s | **51% ATTACK.** Honest 3/Malicious 2 → 2/3, the chain forks into two branches, integrity falls 72 → 58 → 43, then CHAIN HELD. |
| 50–58s | Silence. A block. Its hash generates character by character. It connects. **CHAINBREAK.** |

---

## Exporting the video

Press **● RECORD VIDEO**. It plays the trailer once and saves
`chainbreak-trailer-1080x1920.webm` (~60 MB at 10 Mbps).

**Keep the tab visible for the full 58 seconds.** The recorder pushes each drawn frame
explicitly rather than relying on the compositor, which makes it far more robust than
a naive canvas capture — but a browser will still throttle the render loop of a tab
you have switched away from, which lowers the frame rate.

Use **Chrome or Edge**. Safari's MediaRecorder support for WebM is unreliable.

### Converting to MP4 for Instagram / TikTok

Both platforms prefer MP4, and MediaRecorder's WebM has no duration header (some
uploaders show it as 0:00 until it is remuxed). One command fixes both:

ffmpeg is already installed on this machine (`winget install Gyan.FFmpeg`). The
command below is the one that produced the delivered files — `-fflags +genpts`
is what rebuilds the missing timestamps, and `-r` forces a constant frame rate
so the uploaders accept it:

```bash
ffmpeg -y -fflags +genpts -i chainbreak-trailer-1080x1920.webm -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -level 4.2 -r 30 -c:a aac -b:a 192k -ar 48000 -movflags +faststart chainbreak-trailer.mp4
```

Swap `-r 30` for `-r 60` to keep the rapid cuts in the climax smoother — the
recorder captures at roughly 57 fps, so there are real frames to keep.

No ffmpeg? https://cloudconvert.com/webm-to-mp4 does the same job in a browser.

**Sanity-check any re-encode** by confirming the frame count is real rather than
duplicated padding:

```bash
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of default=noprint_wrappers=1 chainbreak-trailer-1080x1920.webm
```

### If recording gives you trouble

Screen-record instead — **Win + G** on Windows opens Game Bar, or use OBS. Put the
browser in fullscreen (F11) first so nothing but the trailer is in shot.

---

## Editing it

- **Shot timing and content** — `timeline.js`. Each scene has an `a`/`b` time range
  and a `draw()`; change the numbers and the cut moves.
- **Music** — the `arrange()` function at the bottom of `score.js`. Times are trailer
  seconds, so a cue lines up with its shot by having the same number.
- **Visual primitives** — `engine.js`: blocks, mesh, transaction cards, integrity
  meter, glitch, grain, vignette.
- **Length** — `DURATION` in `timeline.js`. Shortening it means moving the later
  scenes' ranges too; the score is keyed to absolute seconds.

For a 30-second cut-down, the cleanest edit is to keep 0–7, jump to 32–40, then
40–58: you keep the hook, the betrayal and the whole climax.
