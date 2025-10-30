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
