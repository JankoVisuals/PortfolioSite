/* ========== 1) Home ikonice: bounce on load ========== */
(function initHomeAnim(){
  const icons = document.querySelectorAll('[data-bounce]');
  if(!icons.length) return;
  icons.forEach((el, i) => {
    el.classList.add('bounce-seq');
    el.classList.add(`bounce-delay-${Math.min(i+1,4)}`);
  });
})();

/* ========== 2) Marquee fix (dupliranje ako nedostaje) ========== */
(function ensureMarquee(){
  const m = document.getElementById('logoMarquee');
  if(!m) return;
  // ako slučajno nema duplikata (ručna izmena), dupliciraj
  if(m.children.length < 10){
    const clones = Array.from(m.children).map(n => n.cloneNode(true));
    clones.forEach(c => m.appendChild(c));
  }
})();

/* ========== 3) Portfolio logika ostaje (autoplay/mute/fullscreen) ========== */
// Autoplay + mute u gridu/feature
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
    // tap na video u gridu: mute toggle
    v.addEventListener("click", () => {
      v.muted = !v.muted; v.dataset.sound = v.muted ? "off" : "on"; v.play().catch(()=>{});
    });
    io.observe(v);
  });

  // mute dugmad
  document.querySelectorAll(".mute-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const wrap = btn.closest(".reel-wrap, .feature-wrap");
      const v = wrap.querySelector("video");
      v.muted = !v.muted; v.dataset.sound = v.muted ? "off" : "on"; v.play().catch(()=>{});
    });
  });
})();

// Fullscreen overlay + swipe (TikTok)
(function () {
  const overlay = document.getElementById("fs");
  if (!overlay) return;
  const fsVideo = document.getElementById("fsVideo");
  const fsTitle = document.getElementById("fsTitle");
  const fsSub   = document.getElementById("fsSub");
  const closeBtn = overlay.querySelector(".fs-close");

  // lista projekata po DOM-u
  const nodes = [
    ...document.querySelectorAll(".feature-wrap"),
    ...document.querySelectorAll(".reel-card")
  ];

  const items = nodes.map((node) => {
    const video = node.querySelector("video");
    const t = node.dataset.title || node.querySelector(".reel-title")?.textContent || "";
    const s = node.dataset.sub   || node.querySelector(".reel-sub")?.textContent   || "";
    return { el: node, src: video?.src, title: t, sub: s };
  }).filter(x => !!x.src);

  let idx = 0;

  // mutiraj + pauziraj sve male videe
  function pauseGridVideos() {
    document.querySelectorAll(".reel, .feature").forEach(v=>{
      v.muted = true; v.pause(); v.dataset.sound = "off";
      // resetuj stanje ikona u karticama
      const btn = v.parentElement?.querySelector(".mute-btn");
      if(btn) btn.classList.remove("is-unmuted");
    });
  }
  // vrati autoplay posle izlaska
  function resumeGridVideos() {
    document.querySelectorAll(".reel, .feature").forEach(v=>{
      v.muted = true; v.play().catch(()=>{});
      v.dataset.sound = "off";
      const btn = v.parentElement?.querySelector(".mute-btn");
      if(btn) btn.classList.remove("is-unmuted");
    });
  }

  function openAt(i) {
    idx = Math.max(0, Math.min(items.length - 1, i));
    const { src, title, sub } = items[idx];

    pauseGridVideos();

    fsVideo.src = src;
    fsTitle.textContent = title || "";
    fsSub.textContent = sub || "";
    fsVideo.muted = false;
    fsVideo.playsInline = true;
    fsVideo.loop = true;
    fsVideo.currentTime = 0;

    overlay.classList.add("active");
    document.body.classList.add("no-scroll");
    fsVideo.play().catch(()=>{});
  }

  function closeFS() {
    fsVideo.pause();
    fsVideo.src = "";
    overlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
    resumeGridVideos();
  }

  // fullscreen dugme / dblclick
  document.querySelectorAll(".fullscreen-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const block = btn.closest(".feature-wrap, .reel-card");
      const i = nodes.indexOf(block);
      openAt(i >= 0 ? i : 0);
    });
  });
  document.querySelectorAll(".feature-wrap, .reel-card .reel-wrap").forEach((wrap) => {
    wrap.addEventListener("dblclick", () => {
      const block = wrap.closest(".feature-wrap, .reel-card");
      const i = nodes.indexOf(block);
      openAt(i >= 0 ? i : 0);
    });
  });

  closeBtn?.addEventListener("click", closeFS);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeFS(); });

  // swipe
  let startY=0,endY=0,threshold=40;
  overlay.addEventListener("touchstart",(e)=>{startY=e.changedTouches[0].clientY;},{passive:true});
  overlay.addEventListener("touchend",(e)=>{
    endY=e.changedTouches[0].clientY;
    const d=endY-startY; if(Math.abs(d)<threshold) return;
    if(d<0 && idx<items.length-1) openAt(idx+1); else if(d>0 && idx>0) openAt(idx-1);
  },{passive:true});

  // esc / strelice
  window.addEventListener("keydown",(e)=>{
    if(!overlay.classList.contains("active")) return;
    if(e.key==="Escape") closeFS();
    if(e.key==="ArrowUp")   openAt(Math.max(0, idx-1));
    if(e.key==="ArrowDown") openAt(Math.min(items.length-1, idx+1));
  });
})();
