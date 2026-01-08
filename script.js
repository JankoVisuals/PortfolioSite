// -------- Besplatni resursi: submit --------
(() => {
  const form = document.getElementById("resursi-form");
  if (!form) return;

  const status = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const     const resource_slug = form.resource.value; // "custom-luts"

    if (!email) { 
      status.textContent = "Unesi validan email."; 
      return; 
    }

    status.textContent = "Šaljem…";
    form.querySelector("button[type=submit]").disabled = true;

    try {
      const r = await fetch("/api/sendResource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resource_slug })
      });
      if (!r.ok) throw new Error(await r.text());
      status.textContent = "Poslato! Proveri inbox / spam u narednih par minuta.";
      form.reset();
    } catch (err) {
      console.error(err);
      status.textContent = "Nije uspelo. Pokušaj ponovo.";
    } finally {
      form.querySelector("button[type=submit]").disabled = false;
    }
  });
})();

// -------- Share dugme na naslovnoj --------
(() => {
  const btn = document.getElementById("share-site");
  if (!btn) return;

  const url = "https://jankovisuals.vercel.app";

  btn.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Janko Visuals",
          text: "Pogledaj moj portfolio i ponudu.",
          url
        });
      } else {
        await navigator.clipboard.writeText(url);
        btn.dataset.tip = "Kopirano!";
        setTimeout(() => (btn.dataset.tip = ""), 1500);
      }
    } catch (err) {
      console.error(err);
    }
  });
})();

// -------- Portfolio: autoplay + fullscreen overlay --------
(() => {
  // Radi samo na portfolio.html (proveravamo da li postoji .video-grid)
  const grid = document.querySelector(".video-grid");
  if (!grid) return;

  // 1) Pokušaj da automatski pusti sve videe (muted autoplay je dozvoljen u većini browsera)
  const allVideos = document.querySelectorAll("video.reel, video.feature");
  allVideos.forEach((vid) => {
    vid.muted = true;
    vid.playsInline = true;
    // dodaj atribut autoplay u slučaju da dođeš na stranicu bez JS-a
    vid.setAttribute("autoplay", "autoplay");
    vid.play().catch(() => {
      // ako browser blokira autoplay, korisnik će pokrenuti ručno klikom
    });
  });

  // 2) Mute / unmute za svaki video
  const muteButtons = document.querySelectorAll(".mute-btn");
  muteButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".reel-wrap, .feature-wrap");
      if (!wrap) return;
      const vid = wrap.querySelector("video");
      if (!vid) return;

      vid.muted = !vid.muted;
      if (vid.muted) {
        btn.classList.add("is-muted");
      } else {
        btn.classList.remove("is-muted");
      }
    });
  });

  // 3) Fullscreen overlay logika
  const overlay = document.getElementById("fs");
  const fsVideo = document.getElementById("fsVideo");
  const fsTitle = document.getElementById("fsTitle");
  const fsSub = document.getElementById("fsSub");
  const fsClose = overlay ? overlay.querySelector(".fs-close") : null;

  if (!overlay || !fsVideo || !fsTitle || !fsSub || !fsClose) return;

  function openOverlay(fromWrap, src) {
    const title = fromWrap.dataset.title || "";
    const sub = fromWrap.dataset.sub || "";

    fsVideo.src = src;
    fsVideo.currentTime = 0;
    fsVideo.muted = false;
    fsVideo.setAttribute("autoplay", "autoplay");
    fsVideo.play().catch(() => {});

    fsTitle.textContent = title;
    fsSub.textContent = sub;

    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.add("fs-open");
    document.body.style.overflow = "hidden";
  }

  function closeOverlay() {
    overlay.setAttribute("aria-hidden", "true");
    overlay.classList.remove("fs-open");
    document.body.style.overflow = "";
    fsVideo.pause();
    fsVideo.removeAttribute("src");
  }

  // Klik na fullscreen dugme
  const fullButtons = document.querySelectorAll(".fullscreen-btn");
  fullButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".reel-card, .feature-wrap");
      if (!wrap) return;
      const vid = wrap.querySelector("video");
      if (!vid || !vid.src) return;
      openOverlay(wrap, vid.src);
    });
  });

  // Zatvaranje overlay-a
  fsClose.addEventListener("click", () => closeOverlay());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeOverlay();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("fs-open")) {
      closeOverlay();
    }
  });
})();
