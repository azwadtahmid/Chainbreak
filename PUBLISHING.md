# Publishing CHAINBREAK

The repo is committed and ready. I could not push or deploy for you — neither the
GitHub CLI (`gh`) nor the Vercel CLI is installed on this machine, and I have no
credentials for either account. Both take a couple of minutes.

---

## 1. Push to GitHub

Easiest route — install the GitHub CLI once, then two commands:

```bash
winget install --id GitHub.cli
```

Close and reopen your terminal, then:

```bash
cd C:\Users\azwad\chainbreak && gh auth login
```

```bash
cd C:\Users\azwad\chainbreak && gh repo create chainbreak --public --source=. --remote=origin --push
```

That creates the repo and pushes all three commits.

**Without the CLI:** create an empty repo named `chainbreak` at
https://github.com/new (no README, no .gitignore — the repo already has them), then:

```bash
cd C:\Users\azwad\chainbreak && git remote add origin https://github.com/YOUR-USERNAME/chainbreak.git && git push -u origin main
```

---

## 2. Put it on the web

### GitHub Pages — no account beyond GitHub, free

After pushing: repo → **Settings** → **Pages** → Source: `main`, folder: `/ (root)` → Save.
Live in about a minute at `https://YOUR-USERNAME.github.io/chainbreak/`.

Simplest option, and it costs nothing. The only caveat is that GitHub Pages cannot set
custom headers, so the `vercel.json` / `_headers` files in this repo are ignored there.
For a game with no accounts and no stored data that is not a meaningful risk.

### Vercel — free, and it does apply the security headers

1. Sign in at https://vercel.com with your GitHub account.
2. **Add New → Project**, pick the `chainbreak` repo, **Import**.
3. Framework preset: **Other**. Leave build command and output directory empty —
   this is plain static HTML with no build step.
4. **Deploy**.

You get `https://chainbreak-<something>.vercel.app`. `vercel.json` is already in the
repo, so Vercel applies the headers automatically. `.vercelignore` keeps `tools/` out
of the deployment.

### Netlify

Drag the whole `chainbreak` folder onto https://app.netlify.com/drop. The `_headers`
file is picked up automatically.

---

## What is already live

There is a working hosted copy right now, published from this session:

**https://claude.ai/artifact/39268B86fp2uxTjvmHyo8W**

It is private until you share it — open it, use the **Share** menu, and anyone with
the link can play. Use it today; set up GitHub Pages or Vercel when you want a link
on your own domain.
