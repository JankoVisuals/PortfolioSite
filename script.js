// -------- Besplatni resursi: submit --------
(() => {
  const form = document.getElementById("resursi-form");
  if (!form) return;

  const status = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const resource_slug = form.resource.value; // "sfx.zip" | "cineslog3-luts.zip"

    if (!email) { status.textContent = "Unesi validan email."; return; }

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
    } catch {}
  });
})();
