// ===== Autoplay + mute u gridu =====
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
    v.muted = true;
    v.playsInline = true;
    v.loop = true;

    v.addEventListener("loadeddata", () => v.play().catch(()=>{}));

    // Tap na video (grid) — mute toggle
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
      v.muted = !v.muted;
      v.dataset.sound = v.muted ? "off" : "on";
      v.play().catch(()=>{});
    });
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

  // Lista videa sa stranice
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

  // Pomocne funkcije
  function pauseAllVideos() {
    document.querySelectorAll("video").forEach(v => {
      try { v.muted = true; v.pause(); } catch {}
    });
  }

  function resumeGridAutoplay() {
    document.querySelectorAll(".reel, .feature").forEach(v => {
      try { v.muted = true; v.play().catch(()=>{}); } catch {}
    });
  }

  let idx = 0;

  function openAt(i) {
    idx = Math.max(0, Math.min(items.length - 1, i));

    // Pause everything be
