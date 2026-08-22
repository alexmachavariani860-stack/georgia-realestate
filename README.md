# 🏠 ss.ge Georgia Deal Monitor — Cloud Edition

Fully cloud-hosted: scrapes ss.ge nationwide, scores every flat with Gemini
(`gemini-3.6-flash`), saves 8+/10 deals to Supabase PostgreSQL, and serves a
phone-friendly Streamlit dashboard with a "scrape now" button.

```
├── app.py              # Streamlit dashboard + on-demand scrape trigger
├── scraper.py          # Headless Playwright scraper + Gemini evaluator
├── database.py         # Supabase data layer (tables, dedupe, feed queries)
├── schema.sql          # One-time table setup for the Supabase SQL editor
├── requirements.txt    # Python deps
├── packages.txt        # System deps for Streamlit Community Cloud (Chromium libs)
└── .github/workflows/scrape.yml  # Auto-scrape every 6 h via GitHub Actions
```

---

## Step 1 — Supabase (free PostgreSQL)

1. Go to https://supabase.com → **Start your project** → sign in with GitHub → **New project** (free tier). Pick any name/region/password.
2. When it finishes provisioning, open **SQL Editor**, paste the contents of `schema.sql`, press **Run**. Both tables are created.
3. Collect your keys from **Project Settings → API**:
   - **Project URL** → this is `SUPABASE_URL` (looks like `https://abcdefgh.supabase.co`)
   - **service_role secret key** → this is `SUPABASE_KEY`. ⚠️ Server-side only — it lives in Streamlit/GitHub secrets, never in code or a browser.

## Step 2 — Push to GitHub

From this folder:

```bash
git init
```
```bash
git add .
```
```bash
git commit -m "ss.ge deal monitor"
```

Create a repo at https://github.com/new (it can be **private** — Streamlit Cloud supports private repos), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/ssge-deal-monitor.git
```
```bash
git branch -M main
```
```bash
git push -u origin main
```

`.gitignore` already excludes `properties.db` and local secrets.

## Step 3 — Deploy on Streamlit Community Cloud (free)

1. Go to https://share.streamlit.io → sign in with GitHub → **Create app** → **Deploy a public app from GitHub**.
2. Pick your repo, branch `main`, main file **`app.py`** → **Deploy**.
3. While it builds, open the app's **Settings → Secrets** and paste (TOML format):

   ```toml
   GEMINI_API_KEY = "AIza...your-key"
   SUPABASE_URL = "https://abcdefgh.supabase.co"
   SUPABASE_KEY = "eyJ...service-role-key"
   ```

4. Save — the app reboots with secrets loaded. First press of **🔄 Check for New Deals Now** takes ~1 extra minute while Chromium downloads into the container; after that it's fast.

`packages.txt` is picked up automatically by Streamlit Cloud and installs the Linux libraries Chromium needs.

## Step 4 — Automatic scraping (GitHub Actions)

So deals appear even when nobody presses the button:

1. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Add the same three secrets: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.
2. That's it — `.github/workflows/scrape.yml` runs every 6 hours. Trigger a test run from the **Actions** tab → *Scheduled ss.ge scrape* → **Run workflow**.

## Step 5 — Put it on Dad's iPhone Home Screen

1. Send him the app URL (`https://your-app-name.streamlit.app`).
2. Open it in **Safari** on the iPhone.
3. Tap the **Share** button (square with the up-arrow) → scroll down → **Add to Home Screen** → **Add**.
4. It now opens full-screen like a native app, from anywhere — no laptop involved.

---

## Notes & troubleshooting

- **Cloudflare blocks:** ss.ge sits behind Cloudflare, and datacenter IPs (Streamlit Cloud, GitHub Actions) are challenged more often than home connections. The scraper waits out interstitials and leaves blocked listings un-marked so they're retried next run. If cloud runs get blocked consistently, the GitHub Actions runner usually fares better than Streamlit's container; as a last resort, keep running `python scraper.py` from any home machine — it writes to the same Supabase database, and the dashboard stays fully cloud-hosted either way.
- **Streamlit free tier sleeps** after ~12 h without visitors; the first visit wakes it in ~30 s. The GitHub Actions scraping is unaffected.
- **Tune scan size** with env vars: `MAX_LISTINGS_PER_RUN` (default 30; the dashboard button uses 12 for speed) and `PAGES_TO_SCAN` (default 3).
- **Local run** still works: set the three env vars and run `python scraper.py` / `streamlit run app.py`.
