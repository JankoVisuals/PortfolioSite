// api/sendResource.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const supabaseUrl = reqEnv("SUPABASE_URL");
    const serviceKey   = reqEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey      = reqEnv("SUPABASE_PUBLIC_ANON_KEY"); // koristimo za signed URL helper

    const MAIL_FROM_NAME  = reqEnv("MAIL_FROM_NAME");
    const MAIL_FROM_EMAIL = reqEnv("MAIL_FROM_EMAIL");
    const GMAIL_APP_PASS  = reqEnv("GMAIL_APP_PASS");

    const { email, resource_slug } = req.body as {
      email?: string;
      resource_slug?: string; // "sfx.zip" | "cineslog3-luts.zip"
    };

    if (!email || !resource_slug) {
      return res.status(400).send("Missing email or resource_slug");
    }

    // 1) Supabase klijent (service role – server only)
    const admin = createClient(supabaseUrl, serviceKey);

    // 2) Mapiranje resursa → fajl u Storage-u (u bucketu iz ENV ili "public")
    const BUCKET = process.env.RESOURCES_BUCKET || "public";
    const fileMap: Record<string, string> = {
      "sfx.zip": "SFX.zip",
      "cineslog3-luts.zip": "CineSlog3 LUTs.zip",
    };

    const objectPath = fileMap[resource_slug];
    if (!objectPath) return res.status(400).send("Unknown resource_slug");

    // 3) Generiši privremeni link (60 min)
    const tmpClient = createClient(supabaseUrl, anonKey); // ok je za signed URL
    const { data: signed, error: signedErr } = await tmpClient
      .storage
      .from(BUCKET)
      .createSignedUrl(objectPath, 60 * 60); // 1h

    if (signedErr || !signed?.signedUrl) {
      console.error(signedErr);
      return res.status(500).send("Cannot create signed URL");
    }

    // 4) Log u tabelu resource_requests (email, resource_slug)
    await admin.from("resource_requests").insert({
      email,
      resource_slug,
      user_agent: req.headers["user-agent"] || null,
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || null,
    });

    // 5) Pošalji email (Gmail + App Password)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: MAIL_FROM_EMAIL, pass: GMAIL_APP_PASS },
    });

    const subjectMap: Record<string,string> = {
      "sfx.zip": "Tvoj SFX Sound Pack (ZIP)",
      "cineslog3-luts.zip": "Tvoji CineSlog3 LUTs (ZIP)",
    };

    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111">
        <h2 style="margin:0 0 12px">Hvala na preuzimanju 🎧</h2>
        <p style="margin:0 0 16px">
          Klikni na link ispod da preuzmeš: <b>${objectPath}</b><br/>
          Link važi <b>1 sat</b>.
        </p>
        <p style="margin:0 0 16px">
          <a href="${signed.signedUrl}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px">Preuzmi fajl</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:18px 0"/>
        <p style="font-size:13px;color:#666;margin:0">Ako link istekne, samo pošalji ponovo formu sa sajta.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`,
      to: email,
      subject: subjectMap[resource_slug] || "Resurs",
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[sendResource]", err?.message || err);
    return res.status(500).send(err?.message || "Server error");
  }
}
