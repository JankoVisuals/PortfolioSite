// /api/sendResource.ts
import type { VercelRequest, VercelResponse } from 'vercel';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// ------------- ENV -------------
const {
  SUPABASE_URL = '',
  SUPABASE_ANON_KEY = '',
  SUPABASE_PUBLIC_BUCKET = 'videos', // bucket za videe; za resurse može biti drugi (npr. "resources")
  SUPABASE_PUBLIC_RESOURCES_BUCKET = 'resources', // ← promeni ako koristiš drugi bucket za ZIP-ove
  FROM_EMAIL = 'jankovisuals@gmail.com',
  GMAIL_APP_PASS = '', // Google "App password" (4x4 cifre)
} = process.env;

// Ako ZIP-ovi nisu u "public" bucketu, postavi ispravan bucket ime iz Supabase Storage-a.
const RESOURCES_BUCKET = SUPABASE_PUBLIC_RESOURCES_BUCKET;

// ------------- MAPIRANJE RESURSA -------------
// Slug → naziv fajla u Storage-u (tačno kao što je uploadovano)
const RESOURCE_MAP: Record<string, { filename: string; contentType: string }> = {
  'sfx': { filename: 'SFX.zip', contentType: 'application/zip' },
  'cineslog3-luts': { filename: 'CineSlog3 LUTs.zip', contentType: 'application/zip' },
};

// ------------- HELPERS -------------
function ok(res: VercelResponse, data: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(200).json(data);
}
function bad(res: VercelResponse, msg: string, code = 400) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(code).json({ ok: false, error: msg });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return bad(res, 'Method not allowed', 405);
  }

  try {
    const { email, resource_slug } = req.body || {};

    if (!email || typeof email !== 'string') {
      return bad(res, 'Nedostaje email ili je neispravan.');
    }
    if (!resource_slug || typeof resource_slug !== 'string') {
      return bad(res, 'Nedostaje resource_slug.');
    }

    // STRIKTNO mapiranje (nema tihog fallbacka na SFX!)
    const item = RESOURCE_MAP[resource_slug];
    if (!item) {
      return bad(res, `Nepoznat resource_slug: ${resource_slug}`);
    }

    // Supabase klient (za log + generisanje public URL-a / ili direktan download)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Preuzmi fajl kao Buffer radi slanja kao attachment
    // Ako je bucket "public", možemo koristiti public URL:
    const encodedPath = encodeURIComponent(item.filename).replace(/%20/g, '%20');
    const publicUrl =
      `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(RESOURCES_BUCKET)}/${encodedPath}`;

    const fileResp = await fetch(publicUrl);
    if (!fileResp.ok) {
      return bad(res, `Ne mogu da preuzmem fajl sa Storage-a: ${item.filename}`, 500);
    }
    const arrayBuf = await fileResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Nodemailer (Gmail SMTP sa App password)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: FROM_EMAIL,
        pass: GMAIL_APP_PASS,
      },
    });

    const mail = await transporter.sendMail({
      from: `Janko Visuals <${FROM_EMAIL}>`,
      to: email,
      subject: `Tvoj resurs: ${item.filename}`,
      text:
        `Ćao!\n\n` +
        `Evo fajla koji si tražio/la: ${item.filename}\n\n` +
        `Ako ne vidiš prilog, pogledaj u "All Mail" ili "Spam/Promotions".\n\n` +
        `Pozdrav,\nJanko Visuals`,
      attachments: [
        {
          filename: item.filename,
          content: buffer,
          contentType: item.contentType,
        },
      ],
    });

    // Upis u tabelu (promeni naziv tabele po tvom setupu)
    await supabase.from('resource_requests').insert({
      email,
      resource_slug,
      filename: item.filename,
      sent_at: new Date().toISOString(),
    });

    return ok(res, { ok: true, id: mail.messageId });
  } catch (err: any) {
    console.error(err);
    return bad(res, err?.message || 'Server error', 500);
  }
}
