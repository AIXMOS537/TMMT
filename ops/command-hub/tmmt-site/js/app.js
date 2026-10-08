(() => {
  const WA = "[phone removed]";
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const header = document.querySelector(".header");
  const nav = document.getElementById("nav");
  const menuBtn = document.getElementById("menu-toggle");
  const themeBtn = document.getElementById("theme-toggle");
  const form = document.getElementById("contact-form");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- hardware budget -------------------------------------------------
     The background canvas is the most expensive thing on this page: a
     full-viewport, devicePixelRatio-resolution redraw every frame. Scale it
     to whatever tier js/kernel.js measured for THIS machine. With no kernel
     present we assume the low tier, which is the safe direction to be wrong in.
     -------------------------------------------------------------------- */
  const TIER_BUDGET = {
    lite:     { dpr: 1,   stars: 0,   detail: false, run: false },
    standard: { dpr: 1.5, stars: 70,  detail: true,  run: true },
    full:     { dpr: 2,   stars: 140, detail: true,  run: true },
  };
  let BUDGET = TIER_BUDGET.lite;
  let DPR = 1;

  function readBudget() {
    const tier = document.documentElement.getAttribute("data-tier") || "lite";
    BUDGET = TIER_BUDGET[tier] || TIER_BUDGET.lite;
    if (reduce) BUDGET = { ...BUDGET, stars: Math.min(BUDGET.stars, 40), detail: false, run: false };
    DPR = Math.min(window.devicePixelRatio || 1, BUDGET.dpr);
  }
  readBudget();

  function paintStill() {
    ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "light" ? "#eef2f8" : "#0a0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function restart() {
    readBudget();
    cancelAnimationFrame(raf);
    resize();
    if (BUDGET.run) { tick(); } else { paintStill(); }
  }

  let w = 0;
  let h = 0;
  let stars = [];
  let t = 0;
  let raf = 0;

  function resize() {
    w = canvas.width = window.innerWidth * DPR;
    h = canvas.height = window.innerHeight * DPR;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    stars = Array.from({ length: BUDGET.stars }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.3 + Math.random() * 1.4,
      r: (0.4 + Math.random() * 1.3) * DPR,
    }));
  }

  function drawOrb(cx, cy, progress) {
    const radius = Math.min(w, h) * 0.22 * (1 - progress * 0.35);
    for (let i = 0; i < 90; i += 1) {
      const a = (i / 90) * Math.PI * 2 + t * 0.004;
      const wobble = Math.sin(t * 0.01 + i) * 18 * DPR;
      const x = cx + Math.cos(a) * (radius + wobble);
      const y = cy + Math.sin(a) * (radius * 0.72 + wobble * 0.4);
      ctx.fillStyle = `rgba(147, 184, 255, ${0.18 * (1 - progress)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 * DPR, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
    g.addColorStop(0, `rgba(79, 140, 255, ${0.28 * (1 - progress)})`);
    g.addColorStop(1, "rgba(79, 140, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHelix(progress) {
    const cx = w * 0.5;
    const cy = h * 0.48;
    for (let i = 0; i < 70; i += 1) {
      const p = i / 70;
      const a = p * Math.PI * 8 + t * 0.02;
      const x = cx + Math.cos(a) * (90 * DPR);
      const y = cy + (p - 0.5) * h * 0.55 + Math.sin(a * 0.5) * 12;
      ctx.fillStyle = `rgba(183, 148, 255, ${0.16 * progress})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.4 * DPR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWave(progress) {
    ctx.beginPath();
    const y0 = h * 0.72;
    ctx.moveTo(0, y0);
    for (let x = 0; x <= w; x += 8) {
      const y = y0 + Math.sin(x * 0.008 + t * 0.02) * 28 * DPR * progress;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(138, 152, 181, ${0.22 * progress})`;
    ctx.lineWidth = 1.2 * DPR;
    ctx.stroke();
  }

  function tick() {
    t += 1;
    const scroll = Math.min(1, window.scrollY / Math.max(window.innerHeight, 1));
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a0f1a";
    if (document.documentElement.getAttribute("data-theme") === "light") {
      ctx.fillStyle = "#eef2f8";
    }
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      s.x += s.z * 0.18 * DPR;
      if (s.x > w) s.x = 0;
      ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "light"
        ? "rgba(40, 60, 110, 0.3)"
        : "rgba(190, 205, 235, 0.55)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (BUDGET.detail) {
      const orbFade = Math.min(1, scroll * 1.6);
      drawOrb(w * 0.5, h * 0.38, orbFade);
      if (scroll > 0.18) drawHelix(Math.min(1, (scroll - 0.18) / 0.3));
      if (scroll > 0.48) drawWave(Math.min(1, (scroll - 0.48) / 0.3));
    }

    raf = requestAnimationFrame(tick);
  }

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });

  const savedTheme = localStorage.getItem("tmmt-theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);

  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("tmmt-theme", next);
    /* The animated canvas repaints itself every frame and picks the new ground
       up for free. A still canvas does not — on a machine with no motion budget
       the old ground would sit behind the new theme until the next reload. */
    if (!BUDGET.run) paintStill();
  });

  if (!reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });
    document.querySelectorAll(".reveal").forEach((el, i) => {
      el.style.setProperty("--d", `${(i % 6) * 70}ms`);
      io.observe(el);
    });

    const counters = document.querySelectorAll("[data-count]");
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const end = Number(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const start = performance.now();
        const dur = 1200;
        const step = (now) => {
          const p = Math.min(1, (now - start) / dur);
          el.textContent = `${Math.round(end * p)}${suffix}`;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        cio.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => cio.observe(el));
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
    document.querySelectorAll("[data-count]").forEach((el) => {
      el.textContent = `${el.dataset.count}${el.dataset.suffix || ""}`;
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const service = String(data.get("service") || "").trim();
    const message = String(data.get("message") || "").trim();
    const text = [
      `Hi TMMT — I'm ${name}.`,
      `Email: ${email}`,
      `Service: ${service}`,
      "",
      message,
    ].join("\n");
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", onScroll, { passive: true });
  resize();
  onScroll();
  if (BUDGET.run) { tick(); } else { paintStill(); }

  /* The kernel can demote this machine mid-session after measuring frames.
     Re-read the budget and rebuild the field when it does. */
  if (window.AIXOS && window.AIXOS.kernel) {
    let lastTier = document.documentElement.getAttribute("data-tier");
    window.AIXOS.kernel.on((snap) => {
      if (snap.tier === lastTier) return;
      lastTier = snap.tier;
      restart();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(raf); }
    else if (BUDGET.run) { tick(); }
  });

  window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
})();
