// ===== Autoplay + mute u gridu (robustan init) =====
(function () {
  const videos = document.querySelectorAll("video.reel, video.feature");
  if (!videos.length) return;

  // Važno: postaviti atribute PRE učitavanja (za iOS/Android autoplay)
  videos.forEach((v) => {
    try {
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
    } catch {}
  });

  // IntersectionObserver za pauzu van pogleda
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) {
        // pokušaj play sa fallback retry-jem
        v.play().catch(() => {
          // neki browseri traže mali delay
          setTimeout(() => v.play().catch(()=>{}), 50);
        });
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.35 });

  videos.forEach((v) => {
    // Autoplay na prvom mogućem eventu
    const tryPlay = () => v.play().catch(()=>{});
    v.addEventListener("loadedmetadata", tryPlay, { once: true });
    v.addEventListener("canplay", tryPlay, { once: true });
    // dodatni mikro delay za neke Android webview-e
    setTimeout(tryPlay, 0);

    // Tap na video (u gridu) — mute toggle
    v.addEventListener("click", () => {
      v.muted = !v.muted;
      v.dataset.sound = v.muted ? "off" : "on";
      v.play().catch(()=>{});
    });

    io.observe(v);
  });

  // Mute dugmad u gridu
  document.querySelectorAll(".mute-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const wrap = btn.closest(".reel-wrap, .feature-wrap");
      const v = wrap.querySelector("video");
      if (!v) return;
      v.muted = !v.muted;
      v.dataset.sound = v.muted ? "off" : "on";
      v.play().catch(()=>{});
    });
  });

  // Ako tab ode u background, pauziraj; vrati kad se vrati
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      videos.forEach(v => v.pause());
    } else {
      videos.forEach(v => {
        if (v.muted) v.play().catch(()=>{});
      });
    }
  });
})();


// ===== Fullscreen overlay (TikTok stil) =====
(function () {
  const overlay = document.getElementById("fs");
  if (!overlay) return;

  const fsVideo = document.getElementById("fsVideo");
  const fsTitle = document.getElementById("fsTitle");
  const fsSub   = document.getElementById("fsSub");
  const closeBtn = overlay.querySelector(".fs-close");

  // Lista videa sa stranice (redosled: feature pa grid)
  const nodes = [
    ...document.querySelectorAll(".feature-wrap"),
    ...document.querySelectorAll(".reel-card")
  ];

  const items = nodes.map((node) => {
    const video = node.querySelector("video");
    const t = node.dataset.title || node.querySelector(".reel-title")?.textContent || "";
    const s = node.dataset.sub   || node.querySelector(".reel-sub")?.textContent   || "";
    return { src: video?.src, title: t, sub: s };
  }).filter(x => !!x.src);

  // Helpers: global control
  function pauseAllVideos() {
    document.querySelectorAll("video").forEach(v => {
      try { v.muted = true; v.pause(); } catch {}
    });
  }
  function resumeGridAutoplay() {
    document.querySelectorAll(".reel, .feature").forEach(v => {
      try {
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.muted = true; v.playsInline = true;
        v.play().catch(()=>{ setTimeout(()=>v.play().catch(()=>{}), 50); });
      } catch {}
    });
  }

  let idx = 0;

  function openAt(i) {
    idx = Math.max(0, Math.min(items.length - 1, i));

    // ⛔ zaustavi sve ostale videe pre fullscreen-a
    pauseAllVideos();

    const { src, title, sub } = items[idx];

    // Podesi fsVideo atribute pre učitavanja (autoplay sa zvukom)
    fsVideo.removeAttribute("muted");
    fsVideo.muted = false;
    fsVideo.setAttribute("playsinline", "");
    fsVideo.playsInline = true;
    fsVideo.loop = true;
    fsVideo.src = src;
    fsVideo.currentTime = 0;

    fsTitle.textContent = title || "";
    fsSub.textContent = sub || "";

    overlay.classList.add("active");
    document.body.classList.add("no-scroll");

    // mikro odlaganje da browser primeni pauzu drugima
    setTimeout(() => {
      fsVideo.play().catch(()=>{ /* iOS fallback */ });
    }, 0);
  }

  function closeFS() {
    try { fsVideo.pause(); } catch {}
    fsVideo.removeAttribute("src");
    fsVideo.load(); // očisti buffer (neki Safari bugovi)

    overlay.classList.remove("active");
    document.body.classList.remove("no-scroll");

    // ✅ vrati grid autoplay (mute)
    resumeGridAutoplay();
  }

  // Klik na fullscreen dugme
  document.querySelectorAll(".fullscreen-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const block = btn.closest(".feature-wrap, .reel-card");
      const i = nodes.indexOf(block);
      openAt(i >= 0 ? i : 0);
    });
  });

  // Dvoklik na video/tile otvara fullscreen
  document.querySelectorAll(".feature-wrap, .reel-card .reel-wrap").forEach((wrap) => {
    wrap.addEventListener("dblclick", () => {
      const block = wrap.closest(".feature-wrap, .reel-card");
      const i = nodes.indexOf(block);
      openAt(i >= 0 ? i : 0);
    });
  });

  // Close
  closeBtn.addEventListener("click", closeFS);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeFS(); // klik van videa -> zatvori
  });

  // Swipe up/down
  let startY = 0;
  overlay.addEventListener("touchstart", (e) => { startY = e.changedTouches[0].clientY; }, { passive:true });
  overlay.addEventListener("touchend", (e) => {
    const delta = e.changedTouches[0].clientY - startY;
    if (Math.abs(delta) < 40) return;
    if (delta < 0 && idx < items.length - 1) openAt(idx + 1);
    else if (delta > 0 && idx > 0) openAt(idx - 1);
  }, { passive:true });

  // ESC / arrows
  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("active")) return;
    if (e.key === "Escape") closeFS();
    if (e.key === "ArrowUp")   openAt(Math.max(0, idx - 1));
    if (e.key === "ArrowDown") openAt(Math.min(items.length - 1, idx + 1));
  });
})();


// ===== Email form (ostaje isto) =====
(function () {
  const form = document.getElementById("resursi-form");
  if (!form) return;
  const status = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const resource = form.resource.value;
    if (!email) { status.textContent = "Unesi validan email."; return; }
    status.textContent = "Šaljem…";
    form.querySelector("button[type=submit]").disabled = true;

    try {
      const res = await fetch("/api/sendResource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resource_slug: resource })
      });
      if (!res.ok) throw new Error(await res.text());
      status.textContent = "Poslato! Proveri mail.";
      form.reset();
    } catch {
      status.textContent = "Greška. Pokušaj ponovo.";
    } finally {
      form.querySelector("button[type=submit]").disabled = false;
    }
  });
})();
