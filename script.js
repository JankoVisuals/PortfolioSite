// Selektujemo sve grid videe
const gridVideos = document.querySelectorAll(".reel");

// Funkcija: mutiraj + pauziraj sve male videe
function pauseGridVideos() {
  gridVideos.forEach(v => {
    v.muted = true;
    v.pause();
  });
}

// Funkcija: ponovo pokreni i mute za grid kad izađemo
function resumeGridVideos() {
  gridVideos.forEach(v => {
    v.muted = true;
    v.play().catch(()=>{});
  });
}

// Kad se fullscreen otvori
function openFullscreen(videoEl, title, sub) {
  pauseGridVideos(); // 🛑 MUTIRAJ I STOPIRAJ GRID

  const overlay = document.getElementById('fsOverlay');
  const fsVideo = document.getElementById('fsVideo');

  overlay.classList.add('active');
  fsVideo.src = videoEl.src;
  fsVideo.muted = false;
  fsVideo.play();

  document.getElementById('fsTitle').textContent = title;
  document.getElementById('fsSub').textContent = sub;
  document.body.classList.add("no-scroll");
}

// Kad zatvorimo fullscreen
document.getElementById("fsClose").addEventListener("click", () => {
  const overlay = document.getElementById('fsOverlay');
  overlay.classList.remove('active');

  const fsVideo = document.getElementById('fsVideo');
  fsVideo.pause();
  fsVideo.src = "";

  document.body.classList.remove("no-scroll");

  resumeGridVideos(); // ✅ vrati autoplay mute grid
});
