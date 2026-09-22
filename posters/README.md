# Freshers Fair Posters

Five A3 portrait posters. Open **`posters/index.html`** and press
**DOWNLOAD ALL 5** for print-ready PNGs at 3508 × 4961 (A3 at 300 dpi).

They are drawn in code, in the game's own visual language — same palette, same
mono type, the same block and node-mesh shapes. Nothing is a screenshot, so the
same file renders a small on-screen preview and a full-resolution print without
any upscaling. The hashes on poster 1 are computed with the game's real hash
function: each block's `PREV` genuinely equals the previous block's `HASH`.

---

## The five

| # | Poster | Does what |
|---|--------|-----------|
| 1 | **THE HOOK** | Stops someone walking past. Title, the chain, one question. |
| 2 | **THE CHALLENGE** | Competitive. A falling integrity bar and a leaderboard — drives repeat plays. |
| 3 | **THE SOCIETY** | What joining actually gets you. The credibility poster. |
| 4 | **LEARN BY PLAYING** | Teaches a double spend *on the poster*. For the curious ones who stop and read. |
| 5 | **THE INVITE** | Removes the barrier: "you don't need to know what a blockchain is." |

Put **1** and **2** where people walk past, and **3**, **4**, **5** at the table
where someone has already stopped.

---

## Printing

- **Size** — A3 portrait (297 × 420 mm). The PNGs are 300 dpi, which is what a
  print shop expects.
- **Bleed** — there is none. Everything important sits inside a ~22 mm margin, so
  a borderless print or a trim of a few millimetres loses nothing. If your printer
  asks for 3 mm bleed, tell them to scale to fit — the dark background extends to
  the edge anyway.
- **Paper** — these are dark posters with a lot of black. Matt or satin holds the
  blacks; gloss will mirror the hall lights and you will lose the fine hash text.
- **Other sizes** — A2 is the same file printed larger; the artwork is vector-drawn
  so it holds up. For A4 handouts, use the same PNG scaled down.
- **Social** — **DOWNLOAD ALL 5 (SOCIAL)** gives 1200 × 1697 versions for
  Instagram posts and stories.

## Editing

`posters.js` holds all five as `draw()` functions in a 1200 × 1697 design space;
the renderer scales the context to whatever output size is asked for. Change the
copy, re-open the page, re-export.

The QR panel clamps itself upward if it would collide with the footer — a
collision is invisible on a small preview and ruins a poster that has already
been printed, so the layout refuses to allow it.

To swap the QR, replace `assets/join-qr.png`. To change the society lines, edit
`footer()` at the top of `posters.js`.
