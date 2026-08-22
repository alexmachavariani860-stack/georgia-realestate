"""
ss.ge nationwide flat-for-sale scraper + Gemini deal evaluator (cloud edition).

Runs headless on any Linux container (Streamlit Cloud, GitHub Actions, VPS)
or locally on Windows/Mac. Saves 8+/10 deals to Supabase PostgreSQL.

Required env vars: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY
Optional:          SUPABASE_DB_URL (auto-create tables),
                   MAX_LISTINGS_PER_RUN, PAGES_TO_SCAN (override defaults)
"""

import json
import os
import random
import re
import sys
import time

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

import database as db

# --- playwright-stealth: support both v1 (stealth_sync) and v2 (Stealth) APIs ---
_stealth_apply = None
try:
    from playwright_stealth import Stealth  # v2.x

    _stealth = Stealth()

    def _stealth_apply(page):
        _stealth.apply_stealth_sync(page)
except ImportError:
    try:
        from playwright_stealth import stealth_sync  # v1.x

        def _stealth_apply(page):
            stealth_sync(page)
    except ImportError:
        pass  # fall back to manual evasions only

from google import genai
from google.genai import types

# ----------------------------------------------------------------------------- config

BASE_URL = "https://home.ss.ge"
FEED_URL = f"{BASE_URL}/en/real-estate/l/Flat/For-Sale"
MODEL = "gemini-3.6-flash"
# Fallbacks if the preferred model is ever retired (tried in order):
MODEL_FALLBACKS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]
MIN_SCORE_TO_SAVE = 8
MAX_LISTINGS_PER_RUN = int(os.environ.get("MAX_LISTINGS_PER_RUN", "30"))
PAGES_TO_SCAN = int(os.environ.get("PAGES_TO_SCAN", "3"))

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]


def human_pause(lo=1.5, hi=4.5):
    time.sleep(random.uniform(lo, hi))


# ----------------------------------------------------------------------------- scraping

def make_browser(p):
    browser = p.chromium.launch(
        headless=True,
        args=[
            # Required for root-ish Linux containers (Streamlit Cloud, CI):
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-blink-features=AutomationControlled",
        ],
    )
    context = browser.new_context(
        user_agent=random.choice(USER_AGENTS),
        viewport={"width": random.randint(1280, 1680), "height": random.randint(800, 1000)},
        locale="en-US",
        timezone_id="Asia/Tbilisi",
        extra_http_headers={"Accept-Language": "en-US,en;q=0.9,ka;q=0.8"},
    )
    # Manual evasion in case playwright-stealth is missing
    context.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
    )
    page = context.new_page()
    if _stealth_apply:
        _stealth_apply(page)
    return browser, page


def wait_out_cloudflare(page, max_wait=30):
    """If a Cloudflare interstitial shows up, wait for it to clear."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        title = (page.title() or "").lower()
        if "just a moment" not in title and "attention required" not in title:
            return True
        time.sleep(2)
    return False


DETAIL_URL_RE = re.compile(r"/en/real-estate/[^\"']*-\d+/?$")


def collect_listing_urls(page):
    """Walk the feed pages and return unique detail-page URLs."""
    urls = []
    for page_no in range(1, PAGES_TO_SCAN + 1):
        feed = FEED_URL if page_no == 1 else f"{FEED_URL}?page={page_no}"
        print(f"[feed] loading {feed}", flush=True)
        try:
            page.goto(feed, wait_until="domcontentloaded", timeout=60000)
        except PWTimeout:
            print("[feed] timeout, skipping page", flush=True)
            continue
        if not wait_out_cloudflare(page):
            print("[feed] Cloudflare challenge did not clear; stopping.", flush=True)
            break
        human_pause()
        # Nudge lazy-loading
        for _ in range(3):
            page.mouse.wheel(0, random.randint(1200, 2000))
            time.sleep(random.uniform(0.6, 1.4))

        hrefs = page.eval_on_selector_all(
            "a[href*='/en/real-estate/']", "els => els.map(e => e.getAttribute('href'))"
        )
        found = 0
        for href in hrefs:
            if not href:
                continue
            if not DETAIL_URL_RE.search(href.split("?")[0]):
                continue
            full = href if href.startswith("http") else BASE_URL + href
            full = full.split("?")[0]
            if full not in urls:
                urls.append(full)
                found += 1
        print(f"[feed] page {page_no}: {found} listing URLs", flush=True)
        human_pause()
    return urls


def _first_text(page, selectors):
    for sel in selectors:
        try:
            el = page.query_selector(sel)
            if el:
                txt = el.inner_text().strip()
                if txt:
                    return txt
        except Exception:
            continue
    return ""


def parse_area(text):
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:m²|m2|sq\.?\s*m|კვ)", text, re.IGNORECASE)
    return float(m.group(1).replace(",", ".")) if m else None


def scrape_listing(page, url):
    """Extract fields from one listing detail page. Defensive: uses several
    selector fallbacks because ss.ge changes class names often."""
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
    except PWTimeout:
        return None
    if not wait_out_cloudflare(page):
        return None
    human_pause(1.0, 2.5)

    title = _first_text(page, ["h1", "[class*='title'] h1", "[class*='Title']"])
    price = _first_text(
        page, ["[class*='price']", "[class*='Price']", "span:has-text('$')"]
    )
    location = _first_text(
        page, ["[class*='address']", "[class*='Address']", "[class*='location']", "[class*='Location']"]
    )
    body = page.inner_text("body")

    area = parse_area(_first_text(page, ["[class*='area']", "[class*='Area']"]) or "") or parse_area(body)

    desc = _first_text(
        page, ["[class*='description']", "[class*='Description']", "article", "[class*='about']"]
    )
    if not desc:
        desc = body[:4000]

    if not title:
        return None
    return {
        "url": url,
        "title": title,
        "price": price,
        "area_sqm": area,
        "location": location,
        "description": desc[:6000],
    }


# ----------------------------------------------------------------------------- Gemini

ANALYSIS_PROMPT = """You are a Georgian real-estate deal analyst reviewing a listing from ss.ge.

Listing data:
Title: {title}
Price (raw): {price}
Area: {area} m²
Location (raw): {location}
Description:
{description}

Do the following, using knowledge of the Georgian market:
1. Extract the city/region from the location text (e.g., Tbilisi, Batumi, Kutaisi, Rustavi, Gori...).
   If it's Tbilisi, also identify the district (Vake, Saburtalo, Gldani, Didi Dighomi, etc.).
2. Compute price per m² in USD (convert from GEL at ~2.7 GEL/USD if the price is in lari).
3. Judge the $/m² against the LOCAL market, not a single national number:
   - Central Tbilisi (Vake, Vera, Saburtalo, Old Town): ~$1200-2500+/m² is normal; under ~$1000 is cheap.
   - Outer Tbilisi (Gldani, Varketili, Temka): ~$700-1100/m² is normal.
   - Batumi: ~$800-1500/m² depending on sea proximity.
   - Regional towns (Kutaisi, Rustavi, Gori, Zugdidi, Telavi): ~$400-800/m² is normal.
4. Red flags: 'black frame' / shavi karkasi (shell condition), basement or semi-basement (sardafi),
   high agency fees, commercial-space conversions, very old un-renovated soviet blocks priced as renovated,
   suspiciously vague location, price that is too good to be true (scam risk).
5. Positive signs: urgent sale wording, fully renovated / turnkey ('tetri karkasi' completed or 'with renovation'),
   newly built and finished, price/m² clearly below the local norm, good floor, near metro (in Tbilisi).
6. Score the deal 1-10 (10 = exceptional bargain worth calling about today) and write a 2-sentence summary
   a buyer's father could read on his phone.

Respond with JSON only:
{{"city": str, "district": str|null, "price_per_sqm": number|null,
  "red_flags": [str], "positives": [str], "score": int, "summary": str}}"""


def resolve_model(client):
    """Verify the API key works and pick an available flash model, before we
    spend any time scraping. Exits with a clear message on bad key/model."""
    try:
        available = {m.name.split("/")[-1] for m in client.models.list()}
    except Exception as e:
        sys.exit(
            f"Could not reach the Gemini API (bad or missing API key?): {e}\n"
            "Get a key at https://aistudio.google.com/apikey and set GEMINI_API_KEY."
        )
    for candidate in [MODEL] + MODEL_FALLBACKS:
        if candidate in available:
            print(f"[gemini] using model: {candidate}", flush=True)
            return candidate
    flash = [n for n in available if "flash" in n and not any(
        x in n for x in ("image", "live", "tts", "audio", "lite"))]
    if flash:
        pick = sorted(flash)[-1]
        print(f"[gemini] preferred models unavailable, using: {pick}", flush=True)
        return pick
    sys.exit(f"No usable Gemini flash model found. Available: {sorted(available)}")


PERMANENT_ERRORS = ("404", "NOT_FOUND", "PERMISSION_DENIED", "API_KEY_INVALID", "401", "403")


def analyze_with_gemini(client, model, listing):
    prompt = ANALYSIS_PROMPT.format(
        title=listing["title"],
        price=listing["price"] or "unknown",
        area=listing["area_sqm"] or "unknown",
        location=listing["location"] or "unknown",
        description=listing["description"],
    )
    for attempt in range(3):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            data = json.loads(resp.text)
            data["score"] = int(data.get("score", 0))
            return data
        except Exception as e:
            msg = str(e)
            if any(code in msg for code in PERMANENT_ERRORS):
                # Model gone or key revoked mid-run: retrying won't help.
                sys.exit(f"Fatal Gemini error (fix key/model and rerun): {msg}")
            print(f"  [gemini] attempt {attempt + 1} failed: {e}", flush=True)
            time.sleep(5 * (attempt + 1))
    return None


# ----------------------------------------------------------------------------- main

def main():
    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("GEMINI_API_KEY is not set. See README.md.")

    client = genai.Client()  # reads GEMINI_API_KEY from the environment
    model = resolve_model(client)  # fail fast, before any scraping
    db.ensure_tables()
    saved = 0

    with sync_playwright() as p:
        browser, page = make_browser(p)
        try:
            urls = collect_listing_urls(page)
            print(f"[run] {len(urls)} listing URLs found on the feed", flush=True)

            new_urls = db.filter_new_urls(urls)[:MAX_LISTINGS_PER_RUN]
            print(f"[run] {len(new_urls)} are new (cap {MAX_LISTINGS_PER_RUN})", flush=True)

            for i, url in enumerate(new_urls, 1):
                print(f"[{i}/{len(new_urls)}] {url}", flush=True)
                listing = scrape_listing(page, url)
                if not listing:
                    # Leave it un-seen so a future run (maybe with a friendlier
                    # IP) can retry it.
                    print("  could not extract listing, skipped", flush=True)
                    continue

                analysis = analyze_with_gemini(client, model, listing)
                if not analysis:
                    print("  Gemini analysis failed, will retry next run", flush=True)
                    continue

                # Only mark seen once fully evaluated
                db.mark_seen(url)
                score = analysis["score"]
                print(f"  score {score}/10 — {analysis.get('city')}", flush=True)
                if score >= MIN_SCORE_TO_SAVE:
                    db.save_deal(listing, analysis)
                    saved += 1
                    print("  *** SAVED as a hot deal ***", flush=True)
                human_pause(2.0, 6.0)
        finally:
            try:
                browser.close()
            except Exception:
                pass  # avoid noisy tracebacks on Ctrl+C

    print(f"\nDone. {saved} high-scoring deal(s) saved to Supabase.", flush=True)


if __name__ == "__main__":
    main()
