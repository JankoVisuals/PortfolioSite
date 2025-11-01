// ===== Autoplay + mute u gridu (kao i ranije) =====
(function () {
  const videos = document.querySelectorAll("video.reel, video.feature");
  if (!videos.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
  }, { threshold: 0.4 });

  videos.forEach((v) => {
    v.muted = true; v.playsInline = true; v.loop = true;
    v.addEventListener("loadeddata", () => v.play().catch(()=>{}));
    // Tap na video (u gridu) i dalje mute toggle
    v.addEventListener("click", () => {
      v.muted = !v.muted; v.dataset.sound = v.muted ? "off" : "on"; v.play().catch(()=>{});
    });
    io.observe(v);
  });

  // Mute dugmad
  document.querySelectorAll(".mute-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const wrap = btn.closest(".reel-wrap, .feature-wrap");
      const v = wrap.querySelector("video");
      v.muted = !v.muted; v.dataset.sound = v.muted ? "off" : "on"; v.play().catch(()=>{});
    });
  });
})();

// ===== Fullscreen overlay + TikTok swipe =====
(function () {
  const overlay = document.getElementById("fs");
  if (!overlay) return;
  const fsVideo = document.getElementById("fsVideo");
  const fsTitle = document.getElementById("fsTitle");
  const fsSub   = document.getElementById("fsSub");
  const closeBtn = overlay.querySelector(".fs-close");

  // Gradimo listu projekata iz DOM-a (redosled: feature, pa grid)
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

  let idx = 0;

  function openAt(i) {
    idx = Math.max(0, Math.min(items.length - 1, i));
    const { src, title, sub } = items[idx];
    fsVideo.src = src;
    fsTitle.textContent = title || "";
    fsSub.textContent = sub || "";
    fsVideo.muted = false;           // zvuk uključen
    fsVideo.playsInline = true;
    fsVideo.loop = true;
    fsVideo.currentTime = 0;
    overlay.classList.add("active");
    document.body.classList.add("no-scroll");

    // start playback sa zvukom (user gesture je klik otvaranja)
    fsVideo.play().catch(()=>{ /* iOS fallback ako ipak ne pusti */ });
  }

  function closeFS() {
    fsVideo.pause();
    overlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
  }

  // Klik na fullscreen dugme u gridu/feature
  document.querySelectorAll(".fullscreen-btn").forEach((btn, buttonIndex) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // nađi indeks po DOM nodu
      const block = btn.closest(".feature-wrap, .reel-card");
      const i = nodes.indexOf(block);
      openAt(i >= 0 ? i : 0);
    });
  });

  // Takođe: klik direktno na video (celi blok) može da otvori fullscreen
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
    // tap bilo gde osim na video — zatvori
    if (e.target === overlay) closeFS();
  });

  // Swipe up/down za sledeći/prethodni
  let startY = 0, endY = 0, threshold = 40;
  overlay.addEventListener("touchstart", (e) => { startY = e.changedTouches[0].clientY; }, { passive:true });
  overlay.addEventListener("touchend", (e) => {
    endY = e.changedTouches[0].clientY;
    const delta = endY - startY;
    if (Math.abs(delta) < threshold) return;
    if (delta < 0 && idx < items.length - 1) { // swipe up -> next
      openAt(idx + 1);
    } else if (delta > 0 && idx > 0) {         // swipe down -> prev
      openAt(idx - 1);
    }
  }, { passive:true });

  // Keyboard (desktop)
  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("active")) return;
    if (e.key === "Escape") closeFS();
    if (e.key === "ArrowUp")   openAt(Math.max(0, idx - 1));
    if (e.key === "ArrowDown") openAt(Math.min(items.length - 1, idx + 1));
  });
})();

// ===== Resursi forma (ostaje isto) =====
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
      status.textContent = "Poslato! Proveri inbox/promotions/spam.";
      form.reset();
    } catch (err) {
      status.textContent = "Nije uspelo. Pokušaj ponovo.";
      console.error(err);
    } finally {
      form.querySelector("button[type=submit]").disabled = false;
    }
  });
})();
