// Adds bounce-in stagger on homepage icons when index.html loads
function initHomeAnim() {
  const icons = document.querySelectorAll('[data-bounce]');
  icons.forEach((el, i) => {
    el.classList.add('bounce-seq');
    if (i === 0) el.classList.add('bounce-delay-1');
    if (i === 1) el.classList.add('bounce-delay-2');
    if (i === 2) el.classList.add('bounce-delay-3');
    if (i === 3) el.classList.add('bounce-delay-4');
  });
}
document.addEventListener('DOMContentLoaded', initHomeAnim);



// === Portfolio video logic: autoplay, pause offscreen, mute toggle, dblclick fullscreen ===
(function () {
  const vids = Array.from(document.querySelectorAll('video.reel, video.feature'));
  if (!vids.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { v.play().catch(()=>{}); }
      else { v.pause(); }
    });
  }, { threshold: 0.35 });

  vids.forEach((v) => {
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    v.addEventListener('loadeddata', () => v.play().catch(()=>{}));
    io.observe(v);

    // single tap = mute/unmute
    v.addEventListener('click', () => {
      v.muted = !v.muted;
      v.dataset.sound = v.muted ? 'off' : 'on';
      if (!v.paused) v.play().catch(()=>{});
    });

    // double tap = fullscreen
    let last = 0;
    v.addEventListener('pointerdown', () => {
      const now = Date.now();
      if (now - last < 280) {
        const any = v;
        (any.requestFullscreen || any.webkitRequestFullscreen || any.webkitEnterFullscreen)?.call(v);
      }
      last = now;
    });
  });

  // sync za okruglo dugme (ako postoji)
  document.querySelectorAll('.reel-btn').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const wrap = btn.closest('.reel-wrap, .feature-wrap');
      const v = wrap.querySelector('video');
      v.muted = !v.muted;
      v.dataset.sound = v.muted ? 'off' : 'on';
      if (!v.paused) v.play().catch(()=>{});
    });
  });
})();
