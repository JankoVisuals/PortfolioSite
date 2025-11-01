// === Portfolio video autoplay + mute toggle + iOS support ===
(function () {
  const videos = document.querySelectorAll("video.reel, video.feature");
  if (videos.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: 0.4 });

    videos.forEach((v) => {
      v.muted = true; v.playsInline = true; v.loop = true;
      v.addEventListener("loadeddata", () => v.play().catch(()=>{}));
      v.addEventListener("click", () => {
        v.muted = !v.muted; v.dataset.sound = v.muted ? "off" : "on"; v.play().catch(()=>{});
      });
      observer.observe(v);
    });

    document.querySelectorAll(".reel-btn").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const wrap = btn.closest(".reel-wrap, .feature-wrap");
        const v = wrap.querySelector("video");
        v.muted = !v.muted; v.dataset.sound = v.muted ? "off" : "on"; v.play().catch(()=>{});
      });
    });
  }
})();

// === Besplatni resursi: submit u Vercel serverless /api/sendResource ===
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
        body: JSON.stringify({
          email,            // tvoj handler upisuje u Supabase (resource_requests)
          resource_slug: resource // ako tvoj handler očekuje 'resource' umesto 'resource_slug', promeni ključ ovde
        })
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Greška na serveru");
      }

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
