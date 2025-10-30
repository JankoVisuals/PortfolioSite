// api/sendResource.ts
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const start = Date.now();
  const log = (msg: string, extra?: any) =>
    console.log(`[sendResource] ${msg}`, extra ?? "");

  try {
    const { email, resource } = req.body ?? {};
    log("incoming", { email, resource });

    if (!email) return res.status(400).json({ error: "Missing email" });

    // 1) Mapiramo SVE na SFX.zip (za test fazu)
    const MAP: Record<string, { filename: string }> = {
      sfx: { filename: "SFX.zip" },
    };
    const picked = MAP[resource || "sfx"] || MAP.sfx;
    const filename = picked.filename;

    // 2) Supabase client (SERVICE ROLE KEY!)
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      log("env missing", { SUPABASE_URL: !!SUPABASE_URL, SRK: !!SUPABASE_SERVICE_ROLE_KEY });
      return res.status(500).json({ error: "Server env not configured" });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3) Generiši potpisani link iz bucketa "resources"
    const { data: signed, error: signErr } = await sb
      .storage
      .from("resources")
      .createSignedUrl(filename, 60 * 60); // 1h

    if (signErr || !signed?.signedUrl) {
      log("signed url error", signErr ?? {});
      return res.status(500).json({ error: "Failed to sign resource link" });
    }

    // 4) Upis u tabelu (ako postoji)
    try {
      await sb.from("resource_requests").insert({
        email,
        resource: "sfx",
        filename,
        ts: new Date().toISOString(),
      });
    } catch (e) {
      // Nije kritično ako tabela ne postoji – samo log
      log("insert non-blocking error", e);
    }

    // 5) Gmail slanje
    const GMAIL_ADDRESS = process.env.GMAIL_ADDRESS!;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD!;
    if (!GMAIL_ADDRESS || !GMAIL_APP_PASSWORD) {
      log("gmail env missing", { GMAIL_ADDRESS: !!GMAIL_ADDRESS, GMAIL_APP_PASSWORD: !!GMAIL_APP_PASSWORD });
      return res.status(500).json({ error: "Mail env not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_ADDRESS, pass: GMAIL_APP_PASSWORD },
    });

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#111">
        <p>Zdravo,</p>
        <p>Evo tvog <b>SFX Sound Pack</b> preuzimanja:</p>
        <p><a href="${signed.signedUrl}" style="color:#7c3aed">Preuzmi SFX.zip</a> (link važi 1 sat)</p>
        <hr />
        <p>Janko Visuals Produkcija</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Janko Visuals" <${GMAIL_ADDRESS}>`,
      to: email,
      subject: "SFX Sound Pack – download link",
      html,
      replyTo: GMAIL_ADDRESS,
    });

    log("done", { ms: Date.now() - start });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[sendResource] fatal", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
