# CHAINBREAK

**DEFEND THE NETWORK. PROTECT THE CHAIN.**
A 120-second single-player blockchain defence game for the Brunel Blockchain Society Freshers Week stall.

---

## Running it at the stall

Double-click **`index.html`**. That's it — no server, no install, no internet, no login.

It uses plain HTML/CSS/vanilla JS with no build step and no external requests, so it runs
straight off a USB stick on any modern laptop browser.

**Stall setup tips**
- Press **F11** for fullscreen before the first player arrives.
- Target resolutions are 1366×768 and 1920×1080; both fit with no scrolling. It reflows
  sensibly down to ~1024×600.
- Leave it on the start screen between players; the ambient node field draws people in.
- Point first-timers at **HOW TO PLAY** — it's a ~60 second guided walk-through and it
  rolls straight into a real round when it finishes.
- Scores persist in `localStorage`, so the leaderboard survives refreshes and reboots on
  that laptop. If storage is blocked, it falls back to an in-memory board for the session
  and says so on the end screen.
  One caveat worth knowing before the day: opened as a `file://` page, Chrome and Firefox
  allow `localStorage`, but Safari blocks it — there the leaderboard would reset when the
  page reloads. If you're on Safari, or you just want persistence guaranteed, run
  `node tools/serve.js` and open `http://localhost:4173` instead. Everything else about the
  game is identical either way.
- Sound is browser-synthesised (no audio files). The **♪** button and the **M** key mute it.
  If the stall is loud, just leave it muted — nothing depends on audio.

**Clearing the leaderboard** (e.g. at the start of each day) — in the browser console:

```js
CB.board.clear()
```

---

## The leaderboard

**LEADERBOARD** on the start screen opens the Hall of Validators: every saved
score, ranked, with the date and time, plus rounds played and the high score.
The start screen also shows a running "N ROUNDS PLAYED · HIGH SCORE" line.

Only **completed real rounds** are counted. The tutorial has no score and can
never add a row — it hands off to a real round before any scoring happens, and
`showEnd` refuses outright if the run was a demo. A score is only listed once the
player types a name and presses SAVE SCORE, and the button disables after one
save so a single round cannot be entered twice.

**Where it is stored, honestly:** in `localStorage`, on that browser, on that
laptop. It survives refreshes, restarts and power cuts, and there is no expiry —
but it is *per-machine*. Two laptops at the stall keep two separate boards, and
clearing site data clears it. A single global board shared across devices would
need a backend, which this project deliberately does not have.

### Removing entries

Press **MANAGE** on the Hall of Validators. A **✕** appears beside every name:

- **Delete one** — click ✕ and that row turns red, offering **DELETE** / **✕**.
  Click DELETE to remove it, or ✕ to back out. Nothing is removed on the first
  click, so a misclick costs nothing.
- **Delete everything** — **CLEAR ALL** also takes two clicks: the first arms it
  and the button changes to "CONFIRM · WIPE ALL n". It disarms itself after four
  seconds if you walk away. This one also resets the rounds-played and high-score
  counters — it is the start-of-day reset.
- **Escape** backs out one level at a time: armed row → manage mode → the board.

Deleting a name does **not** reduce ROUNDS PLAYED. The round still happened, and
entering a name was always optional, so "rounds played" is legitimately higher
than "validators listed".

Manage mode is off every time the board opens and never persists. The controls
sit behind a toggle deliberately: a delete button next to every name on an
unattended stall laptop is an invitation to wipe someone's score for a laugh.
There is no password on it — anyone at the keyboard can still get in, so it
guards against mischief and misclicks, not against a determined person.

---

## How a round plays

120 seconds, six phases, escalating.

| Time | Phase | What the player does |
|------|-------|----------------------|
| 0–24s | **Validate** | Accept or reject incoming transactions |
| 24–44s | **Double spend** | Same balance promised twice — only one may pass |
| 44–62s | **Build a block** | Pick 4 sound transactions, watch the hash form, mine it |
| 62–80s | **Chain audit** | Find the block whose recomputed hash no longer matches |
| 80–100s | **Peer audit** | Track broadcast records, isolate the lying node |
| 100–120s | **51% attack** | Hold the honest majority while peers turn hostile |

Under the round clock there are four other countdowns: the per-card decision window
(3.5s early, tightening to 2.1s in the attack), a 10s chain audit, a 9s cooldown before an
isolated peer rejoins, and a hostile node flip every ~5.5s during the finale.

**Controls** — mouse-first; every action is clickable. Keyboard is optional:
`A` accept · `R` reject · `Space` mine block · `1`–`5` isolate that node · `I` isolate the
worst-behaved peer · `M` mute.

**Scoring** — correct calls, double-spends blocked, clean blocks, tampering found, peers
isolated, and surviving the attack. Combo multiplier at 3 / 6 / 10 consecutive correct
actions (×2 / ×3 / **CHAIN MASTER ×4**). Mistakes cost points and chain integrity; at 0%
integrity the chain collapses and the round ends immediately.

---

## HOW TO PLAY (the tutorial)

The second button on the start screen runs a guided version of the real game. It uses the
real ledger, real chain and real UI — the cards are genuine and the hashes are genuinely
computed — but removes all pressure: no round clock, no card timer, no scoring, no
integrity loss. A wrong answer explains itself and lets the player try again.

Eight steps: the network, an honest payment, a forged signature, an overspend, both halves
of a double spend, the tampered block, and a wrap-up. **SKIP TO GAME** is always available,
and finishing drops the player straight into a real round.

The double-spend pair is the nicest bit of teaching in it: the player accepts the first
card, and that act visibly flips the twin's nonce to `USED` and drops the sender's balance —
so the second card is invalid *because of what they just did*.

To change the wording or the order of the steps, edit `buildSteps()` in `js/tutorial.js`.

---

## The blockchain is real, not decorative

Every claim the game makes on screen is actually computed:

- **Signatures** — each transaction is signed over `from|to|amount|nonce`. `SIG FORGED`
  means the recomputed signature genuinely does not match the payload.
- **Balances** — a real ledger. `SENDER AVAIL` is the live balance, and accepting a
  transaction actually moves the money.
- **Double spends** — enforced by spent-nonce tracking, not by a scripted message. The
  second half of a conflicting pair is invalid *because* the first one burned that nonce.
  Reject the first instead and the second becomes legitimately valid — the game validates
  against live state, so there is never an unanswerable card.
- **Block hashes** — a block's hash is a digest of its index, previous hash, every
  transaction in it, and its nonce. In the builder, the draft hash changes as you add or
  remove transactions, because it is recomputed from the actual contents.
- **Tampering** — the attacker edits an amount inside a sealed block and leaves the stored
  hash alone. Recomputing exposes it: exactly one block has `RECALC ≠ HASH`, and its child
  still commits to the stale hash. That is the whole lesson, made clickable.
- **Malicious peers** — identified from each node's real broadcast record, not from its
  colour. Isolation is authorised only once a peer's own traffic incriminates it, is always
  temporary, and can never drop the network below two peers.

The digest is a fast non-cryptographic hash (FNV-1a plus avalanche mixing), chosen so it is
readable at six hex characters. It is deterministic and content-sensitive — one changed byte
gives a completely different digest — which is all the chain-link mechanics need.

---

## Fairness rules the generator guarantees

Randomness varies the names, amounts, order, threat type, timings, tampered block and
malicious node — but never whether a situation is solvable:

- Every generated transaction is invalid for exactly one clearly visible reason.
- Insufficient-funds cards are never marginal (always well over the balance).
- Only one account has a live card at a time, so the balance printed on a card is still the
  balance that decides it.
- The block pool always contains exactly 4 sound transactions out of 6, each from a
  different sender.
- The tampered block is always inside the visible window and never the chain tip.
- The network can never be isolated below two peers, and isolation always expires.

Automated checks for all of this live in `tools/` (see below).

---

## Branding assets

| File | Where it appears |
|------|------------------|
| `assets/logo.png` | Start screen (large), end-screen footer, apple-touch icon |
| `assets/logo-mark.png` | Top bar during play, browser tab favicon |
| `assets/join-qr.png` | End screen, on a white plate, under "SCAN TO JOIN" |

Both logo files are generated from the society's white-on-transparent master by
`node tools/make-logo.js`, which crops the transparent padding and resamples down — the
original was 2048×2048 with ~40% empty margin, which looked soft at small sizes and made
the laptop decode a 235 KB image to draw a 46px mark.

**Please test-scan the QR once before the day.** It was supplied as
`qrcode_brunelstudents.com.png`, so it points at brunelstudents.com, but I could not decode
it to confirm the exact destination page. To swap it, just replace `assets/join-qr.png` —
nothing else needs changing. It sits on a white background deliberately: the code is
dark-on-light and will not scan reliably off a dark screen without it.

---

## Security

This is a static page. There is no server, no database, no login, no API, no
environment variables, no secrets and no third-party code — so most of the usual
web-app checklist has nothing to attach to here. What *does* exist has been
tested:

| Surface | Status |
|---|---|
| Third-party dependencies | None. No `package.json`, no `node_modules`, nothing to patch or audit. |
| Secrets / API keys / env vars | None anywhere in the tree. Nothing reads `process.env`. |
| Outbound network calls | None. No `fetch`, `XMLHttpRequest`, `WebSocket` or external URL in the game. |
| XSS | The only user-typed value is the leaderboard name. It passes a character allowlist (`A-Z 0-9 _ . -`) on write **and again on read**, and renders via `textContent`. Verified by injecting `<img onerror>`, `<script>` and `<svg onload>` payloads through both the input and localStorage: nothing executed, no elements created. |
| Untrusted storage | `localStorage` is treated as hostile input — every row is rebuilt field by field, scores clamped to a finite range, malformed entries dropped, oversized blobs rejected. |
| Content-Security-Policy | `default-src 'none'` with `connect-src 'none'` — the page cannot load third-party code or phone home even if someone made it try. Zero violations in normal play. |
| Path traversal (dev server) | `tools/serve.js` confines every request to its own directory. Tested against nine encoded and unencoded traversal variants with a canary file outside the root — all blocked. |
| Exposed files | `.vercelignore` keeps `tools/` off any static deploy. `.gitignore` blocks `.env`, keys and credentials by pattern. |
| Git history | The repository starts at this commit. Nothing sensitive has ever been in it. |

**Not applicable, for the record:** admin routes, authentication, authorisation,
rate limiting, API endpoint hardening, CORS, debug mode, database security and
password hashing. None of these exist in a static page — the game stores no
passwords because it has no accounts, and has no endpoints to rate-limit. If the
project ever grows a backend, that is when this list becomes real work.

### Headers to set at the host

A `<meta>` tag cannot set these — the server must. On Vercel, put them in
`vercel.json`; on Netlify, `_headers`; on GitHub Pages they are not configurable
(which is fine for a game with no accounts and no data).

```
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

`frame-ancestors` is deliberately **not** in the page's meta CSP: browsers ignore
that directive when it arrives via `<meta>` and log a console error for it. It
belongs in a real header, alongside `X-Frame-Options`.

---

## Files

```
index.html          markup and screen structure
css/style.css       all styling, responsive rules, reduced-motion handling
js/util.js          RNG, the hash digest, DOM helpers
js/audio.js         WebAudio synthesis, mute
js/chain.js         transactions, signatures, ledger, blocks, chain audit
js/generator.js     account and transaction generation, fairness guarantees
js/state.js         run state, scoring, combo, integrity, node roster, phase table
js/network.js       node mesh canvas, packets, start-screen field
js/ui.js            all DOM rendering
js/leaderboard.js   local leaderboard (localStorage with in-memory fallback)
js/game.js          phase engine, rules, event handling
js/tutorial.js      the guided HOW TO PLAY walk-through
js/main.js          screen flow, onboarding, end screen, input
assets/             logo and QR code
tools/              development only — not needed to play
```

Nothing in `tools/` is loaded by the game; you can delete the folder before handing the
laptop over if you like.

---

## Tuning

Most knobs are grouped at the top of their file:

- **Round length** — `ROUND_SECONDS` in `js/state.js` (currently 120)
- **Phase timings** — the `PHASES` table just below it. **If you change the round length,
  scale this table too**, or the round will end before the 51% attack fires.
- **Achievement titles** — the `TITLES` table in `js/state.js`
- **Points and penalties** — `PTS` and `DMG` in `js/game.js`
- **How long a player gets per card** — `TX_WINDOW` in `js/game.js`
- **Names used for accounts** — `NAMES` in `js/generator.js`

---

## Development tools

```bash
node tools/logic-test.js   # 30 assertions on hashing, signatures, ledger rules,
                           # double-spend pairs and tamper detection
node tools/pool-test.js    # 3000 block pools on drained ledgers
node tools/make-logo.js    # regenerate the trimmed logo assets from a master PNG
node tools/png-probe.js f  # report a PNG's size, colour type and content bounding box
node tools/serve.js        # optional local server on :4173
```

`tools/autoplay.js` plays a full round using **only what is rendered on screen** and the real
DOM controls — it reads the transaction card, compares HASH against RECALC to find the
tampered block, and reads node record dots to pick the liar. Paste it into the console and
run `CBAuto.round(1800, 0.10)` to simulate a round at 1.8s per decision with a 10% error
rate. If it can finish a round, a human looking at the same pixels has everything they need.

---

BRUNEL BLOCKCHAIN SOCIETY — LEARN. BUILD. CONNECT.
