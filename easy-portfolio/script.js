/* =========================================================
   EASY — interactions
   ========================================================= */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  /* ---------- intro + load ---------- */
  const boot = () => document.body.classList.add("is-loaded");
  if (reduce) {
    document.body.classList.add("is-loaded");
    const intro = document.getElementById("intro");
    if (intro) intro.remove();
  } else {
    // let the fonts settle, then lift the curtain
    window.addEventListener("load", () => setTimeout(boot, 700));
    // safety net if `load` is slow
    setTimeout(boot, 2600);
  }

  /* ---------- year ---------- */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- nav on scroll ---------- */
  const nav = document.getElementById("nav");
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("scrolled", y > 40);
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  const burger = document.getElementById("burger");
  const navLinks = document.getElementById("navLinks");
  const navScrim = document.getElementById("navScrim");
  if (burger && navLinks) {
    const toggle = (open) => {
      navLinks.classList.toggle("open", open);
      if (navScrim) navScrim.classList.toggle("show", open);
      burger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("lock", open);
    };
    burger.addEventListener("click", () =>
      toggle(!navLinks.classList.contains("open"))
    );
    navLinks.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => toggle(false))
    );
    if (navScrim) navScrim.addEventListener("click", () => toggle(false));
    document
      .querySelector(".nav__brand")
      ?.addEventListener("click", () => toggle(false));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") toggle(false);
    });
  }

  /* ---------- scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    // stagger siblings that share a parent
    const groups = new Map();
    revealEls.forEach((el) => {
      const p = el.parentElement;
      const arr = groups.get(p) || [];
      el.style.transitionDelay = `${Math.min(arr.length, 6) * 0.07}s`;
      arr.push(el);
      groups.set(p, arr);
      io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------- animated counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && !reduce) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const target = +el.dataset.count;
          const dur = 1200;
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(eased * target);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          cio.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => cio.observe(c));
  }

  /* ---------- custom cursor ---------- */
  if (finePointer && !reduce) {
    document.body.classList.add("has-cursor");
    const cur = document.getElementById("cursor");
    const label = cur.querySelector(".cursor__label");
    let cx = window.innerWidth / 2,
      cy = window.innerHeight / 2,
      tx = cx,
      ty = cy;

    window.addEventListener("mousemove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
    });
    const render = () => {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cur.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(render);
    };
    render();

    document.querySelectorAll("[data-cursor]").forEach((el) => {
      const txt = el.getAttribute("data-cursor");
      el.addEventListener("mouseenter", () => {
        if (txt) {
          cur.classList.add("is-label");
          label.textContent = txt;
        } else {
          cur.classList.add("is-hover");
        }
      });
      el.addEventListener("mouseleave", () => {
        cur.classList.remove("is-label", "is-hover");
        label.textContent = "";
      });
    });

    document.addEventListener("mousedown", () => (cur.style.opacity = ".5"));
    document.addEventListener("mouseup", () => (cur.style.opacity = "1"));
  }

  /* ---------- magnetic buttons ---------- */
  if (finePointer && !reduce) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.35;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "translate(0,0)";
      });
    });
  }

})();
