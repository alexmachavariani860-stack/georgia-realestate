# EASY — portfolio site

A hand-built, static portfolio for **EASY** (web design & development).
No backend, no build step. Just open `index.html`.

## Files
- `index.html` — the page content
- `styles.css` — all the styling & animations
- `script.js` — cursor, scroll reveals, magnetic buttons, counters

## Run it locally
Just double-click `index.html`, or serve the folder:
```bash
python -m http.server 5511 --directory easy-portfolio
```
Then open http://localhost:5511

## Before you publish — things to make yours
1. **Your name** — I guessed "Alex" from your email in the About section
   (`index.html`, section `05 — About`). Change it if it's wrong.
2. **Your projects** — the 3 cards under `01 — Selected work` are your real work:
   Orpiri, ES Organizer and Easy. ES Organizer links to its live Vercel site;
   Orpiri and Easy point to the contact section (add a live URL by changing
   their `href`).
   - **Card images** live in `images/` (`orpiri.jpg`, `es-organizer.jpg`,
     `easy.jpg`) — cropped screenshots of the real sites, set as each card's
     background in `styles.css`. Replace a file (keep the name) to update a card.
3. **Contact links** — update the Telegram / Instagram / GitHub URLs at the
   bottom of `index.html` (search for `t.me`, `instagram.com`, `github.com`).
4. **Email** — currently `alexmachavariani860@gmail.com`. Change if needed.

## Publish it for free
This is a plain static site, so any of these work with zero config:
- **Netlify** or **Vercel** — drag the folder onto their dashboard.
- **GitHub Pages** — push the folder to a repo, enable Pages.
- **Cloudflare Pages** — connect the repo or upload directly.

## Notes
- Fonts (Fraunces + Space Grotesk) load from Google Fonts. Offline, it falls
  back to a nice serif/sans pairing automatically.
- Fully responsive. On phones the nav becomes a slide-in drawer (with its own
  "Start a project" button and a tap-to-close backdrop), services stack into
  cards that keep their descriptions, and project photos show a permanent
  "visit" caption since phones have no hover. Breakpoints: 940 / 720 / 480px.
- Respects `prefers-reduced-motion` — animations switch off for visitors who
  ask for less motion.
- The hero shows your **EASY Web Solutions** logo (`images/easy-logo.jpg`). The
  site accent colour is set to your logo's blue/teal in `styles.css`
  (`--accent` / `--accent-2`) — change those two variables to re-theme the
  whole site at once.
