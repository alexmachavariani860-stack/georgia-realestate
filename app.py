"""
Mobile-friendly Streamlit dashboard for ss.ge deals stored in Supabase,
with an on-demand "scrape now" trigger. Deployable on Streamlit Community
Cloud — see README.md.
"""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import streamlit as st

# --- Streamlit Cloud stores secrets in st.secrets; mirror them into os.environ
#     so database.py and the scraper subprocess can read them uniformly. -------
for k in ("GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_DB_URL"):
    if k not in os.environ:
        try:
            if k in st.secrets:
                os.environ[k] = st.secrets[k]
        except FileNotFoundError:
            pass  # no secrets.toml locally; plain env vars are fine

import database as db

APP_DIR = Path(__file__).resolve().parent
SCRAPE_TIMEOUT_S = 900
QUICK_SCAN_LISTINGS = "12"  # keep button-triggered scans short enough for mobile patience

st.set_page_config(page_title="🏠 Deal Feed", page_icon="🏠", layout="centered")

st.markdown(
    """
    <style>
      .block-container { padding-top: 1.2rem; padding-bottom: 3rem; max-width: 640px; }
      .deal-card {
        border: 1px solid rgba(128,128,128,.25);
        border-radius: 14px;
        padding: 14px 16px;
        margin-bottom: 14px;
        box-shadow: 0 1px 4px rgba(0,0,0,.08);
      }
      .deal-price { font-size: 1.35rem; font-weight: 700; margin: 0; }
      .deal-meta  { opacity: .75; font-size: .9rem; margin: 2px 0 8px 0; }
      .deal-score {
        display: inline-block; font-weight: 700; border-radius: 8px;
        padding: 2px 10px; font-size: .95rem; color: white;
      }
      .score-hot  { background: #16a34a; }
      .score-warm { background: #d97706; }
      .deal-notes { font-size: .95rem; line-height: 1.4; margin: 8px 0; }
      .deal-new   { color: #16a34a; font-weight: 600; font-size: .8rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("🏠 Georgia Deal Feed")
st.caption("Flats scored 8+/10 by Gemini from ss.ge")


# ------------------------------------------------------------------ scrape trigger

def ensure_chromium():
    """Install Playwright's Chromium once per container (Streamlit Cloud
    containers start fresh, and Chromium isn't in requirements.txt)."""
    marker = Path.home() / ".pw-chromium-ok"
    if marker.exists():
        return
    subprocess.run(
        [sys.executable, "-m", "playwright", "install", "chromium"],
        check=True,
        capture_output=True,
        timeout=600,
    )
    marker.touch()


def run_scraper():
    env = os.environ.copy()
    env.setdefault("MAX_LISTINGS_PER_RUN", QUICK_SCAN_LISTINGS)
    env.setdefault("PAGES_TO_SCAN", "2")
    return subprocess.run(
        [sys.executable, str(APP_DIR / "scraper.py")],
        capture_output=True,
        text=True,
        timeout=SCRAPE_TIMEOUT_S,
        env=env,
        cwd=str(APP_DIR),
    )


if st.button("🔄 Check for New Deals Now", type="primary", use_container_width=True):
    with st.status("Scanning ss.ge across Georgia...", expanded=True) as status:
        try:
            st.write("Preparing browser…")
            ensure_chromium()
            st.write("Scraping listings and asking Gemini to score them…")
            result = run_scraper()
            tail = "\n".join((result.stdout or "").strip().splitlines()[-12:])
            if result.returncode == 0:
                status.update(label="Scan complete ✅", state="complete", expanded=False)
                if tail:
                    with st.expander("Scan log"):
                        st.code(tail)
                st.cache_data.clear()
                st.rerun()
            else:
                status.update(label="Scan failed", state="error")
                st.error("The scraper exited with an error:")
                st.code((result.stderr or tail or "no output")[-2000:])
        except subprocess.TimeoutExpired:
            status.update(label="Scan timed out", state="error")
            st.error("The scan took too long and was stopped. Try again — "
                     "results found before the timeout are already saved.")
        except Exception as e:
            status.update(label="Scan failed", state="error")
            st.error(f"Could not run the scraper: {e}")


# ------------------------------------------------------------------------- the feed

@st.cache_data(ttl=60)
def load_deals():
    return db.fetch_deals()


try:
    deals = load_deals()
except SystemExit as e:
    st.error(str(e))
    st.stop()

city_filter = st.selectbox(
    "City",
    ["All"] + sorted({d["city"] for d in deals if d.get("city")}),
    label_visibility="collapsed",
)
if city_filter != "All":
    deals = [d for d in deals if d.get("city") == city_filter]

if not deals:
    st.info("No saved deals yet. Tap **Check for New Deals Now** above to run the first scan.")
    st.stop()

today = datetime.now(timezone.utc).date()

for d in deals:
    try:
        created = datetime.fromisoformat(d["created_at"].replace("Z", "+00:00"))
        is_today = created.date() == today
        when = created.astimezone().strftime("%b %d, %H:%M")
    except (TypeError, ValueError, AttributeError):
        is_today, when = False, ""

    ppsqm = f"${d['price_per_sqm']:,.0f}/m²" if d.get("price_per_sqm") else "—/m²"
    area = f"{d['area_sqm']:g} m²" if d.get("area_sqm") else "? m²"
    score_cls = "score-hot" if (d.get("rating") or 0) >= 9 else "score-warm"
    new_badge = '<span class="deal-new">● NEW TODAY</span>' if is_today else ""

    st.markdown(
        f"""
        <div class="deal-card">
          {new_badge}
          <p class="deal-price">{d.get('price') or '?'} <span style="font-weight:400; font-size:1rem;">· {ppsqm} · {area}</span></p>
          <p class="deal-meta">📍 {d.get('city') or ''} — {d.get('location') or ''} · {when}</p>
          <span class="deal-score {score_cls}">★ {d.get('rating')}/10</span>
          <p class="deal-notes">{d.get('ai_notes') or ''}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.link_button("Open on ss.ge ↗", d["url"], use_container_width=True)
