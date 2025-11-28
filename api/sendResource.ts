// /api/sendResource.ts
// Runtime: Node (jer koristimo nodemailer)
export const config = { runtime: "nodejs" };

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  RESOURCES_BUCKET = "resources",
  MAIL_FROM_EMAIL,
  GMAIL_APP_PASS,
} = process.env;

// Mapiranje vrednosti iz <select> na fajl u bucketu
const RESOURCE_MAP: Record<string, string> = {
  "sfx": "SFX.zip",
  "cineslog3-luts": "CineSlog3 LUTs.zip",
};

async function getMailer() {
  const nodemailer = await import("nodemailer");
  return nodemailer.default;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send("Server misconfigured: Supabase env vars missing");
    }
    if (!MAIL_FROM_EMAIL || !GMAIL_APP_PASS) {
      return res.status(500).send("Server misconfigured: Mail env vars missing");
    }

    const { email, resource_slug } = req.body || {};
    if (!email || !resource_slug) {
      return res.status(400).send("Missing email or resource_slug");
    }

    const filename = RESOURCE_MAP[String(resource_slug)];
    if (!filename) {
      return res.status(400).send("Unknown resource");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Pokušaj public URL-a; ako bucket nije public, napravi signed URL
    const path = `${filename}`;
    let fileURL: string | null = null;

    // Prvo probaj public
    const pub = supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
    if (pub?.data?.publicUrl) {
      fileURL = pub.data.publicUrl;
    }

    // Ako nije public ili želiš kontrolisano deljenje, koristi signed URL (važi 24h)
    if (!fileURL) {
      const signed = await supabase.storage.from(RESOURCES_BUCKET).createSignedUrl(path, 60 * 60 * 24);
      if (signed.error) throw signed.error;
      fileURL = signed.data.signedUrl;
    }

    // Zapiši zahtev u tabelu (ako postoji)
    try {
      await supabase.from("resource_requests").insert({
        email,
        resource_slug,
        filename,
        user_agent: req.headers["user-agent"] || null,
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || null,
      });
    } catch {
      // nastavi i ako insert ne uspe
    }

    // Pošalji email sa linkom
    const nodemailer = await getMailer();
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: MAIL_FROM_EMAIL, pass: GMAIL_APP_PASS },
    });

    const subjectMap: Record<string, string> = {
      "sfx": "SFX Sound Pack (ZIP)",
      "cineslog3-luts": "CineSlog3 LUTs (ZIP)",
    };

    const html = `
      <div style="font-family:Inter,system-ui,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5">
        <p>Ćao,</p>
        <p>Traženi resurs: <strong>${subjectMap[resource_slug] || filename}</strong></p>
        <p>Preuzmi: <a href="${fileURL}" target="_blank" rel="noopener">${fileURL}</a></p>
        <hr style="border:none;height:1px;background:#eee;margin:20px 0" />
        <p>Hvala na interesovanju! — Janko Visuals</p>
      </div>
    `;

    await transporter.sendMail({
      from: `Janko Visuals <${MAIL_FROM_EMAIL}>`,
      to: email,
      subject: `Tvoj resurs — ${subjectMap[resource_slug] || filename}`,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[sendResource] Error:", err);
    return res.status(500).send(err?.message || "Internal error");
  }
}
