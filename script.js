// === Portfolio video autoplay + mute toggle + iOS support ===
(function () {
  const videos = document.querySelectorAll("video.reel, video.feature");
  if (!videos.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const v = entry.target;
      if (entry.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
  }, { threshold: 0.4 });

  videos.forEach((v) => {
    v.muted = true;
    v.playsInline = true;
    v.loop = true;

    v.addEventListener("loadeddata", () => v.play().catch(()=>{}));

    v.addEventListener("click", () => {
      v.muted = !v.muted;
      v.dataset.sound = v.muted ? "off" : "on";
      v.play().catch(()=>{});
    });

    observer.observe(v);
  });

  document.querySelectorAll(".reel-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const wrap = btn.closest(".reel-wrap, .feature-wrap");
      const v = wrap.querySelector("video");
      v.muted = !v.muted;
      v.dataset.sound = v.muted ? "off" : "on";
      v.play().catch(()=>{});
    });
  });
})();
