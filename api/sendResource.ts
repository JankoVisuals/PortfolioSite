// /api/sendResource.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

type MapEntry = { filename: string };

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getClientMeta(req: VercelRequest) {
  const ua = (req.headers['user-agent'] as string) || null;
  const ip =
    ((req.headers['x-forwarded-for'] as string)?.split(',')[0] || '').trim() ||
    (req.socket?.remoteAddress as string) ||
    null;
  return { ua, ip };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const t0 = Date.now();
  const log = (msg: string, extra?: any) =>
    console.log(`[sendResource] ${msg}`, extra ?? '');

  try {
    // podrži i JSON i urlencoded body (ako frontend slučajno pošalje string)
    let body: any = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }

    const email = body?.email as string | undefined;
    const resource = (body?.resource as string | undefined) ?? 'sfx';

    log('incoming', { email, resource });

    if (!email) return res.status(400).json({ error: 'Email je obavezan.' });

    const MAP: Record<string, MapEntry> = { sfx: { filename: 'SFX.zip' } };
    const picked = MAP[resource] || MAP.sfx;
    const filename = picked.filename;
    const resourceSlug = resource in MAP ? resource : 'sfx';

    // Supabase
    const SUPABASE_URL = mustGet('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = mustGet('SUPABASE_SERVICE_ROLE_KEY');
    const BUCKET = process.env.SUPABASE_BUCKET_RESOURCES || 'resources';

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Signed URL
    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(filename, 60 * 60);

    if (signErr || !signed?.signedUrl) {
      log('signed url error', signErr ?? {});
      return res.status(500).json({ error: 'Ne mogu da generišem link za preuzimanje.' });
    }

    // 2) DB insert (blokirajući, sa uuid)
    const { ua, ip } = getClientMeta(req);
    const insertRes = await sb
      .from('resource_requests')
      .insert({
        uuid: (globalThis as any).crypto?.randomUUID?.() ?? undefined, // ako kolona postoji i nema default
        email,
        resource_slug: resourceSlug,
        filename,
        user_agent: ua,
        ip,
        created_at: new Date().toISOString(),
      })
      .select(); // ← blokirajuće: vrati grešku ako ne uspe

    if (insertRes.error) {
      log('insert error', insertRes.error);
      return res.status(500).json({ error: 'DB insert failed', details: insertRes.error.message });
    } else {
      log('insert ok', insertRes.data);
    }

    // 3) Email
    const GMAIL_ADDRESS = mustGet('GMAIL_ADDRESS');
    const GMAIL_APP_PASSWORD = mustGet('GMAIL_APP_PASSWORD');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_ADDRESS, pass: GMAIL_APP_PASSWORD },
    });

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#eaeaea;background:#0b0b0b;padding:24px">
        <div style="max-width:520px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;padding:20px">
          <h2 style="margin:0 0 8px 0;color:#fff">SFX Sound Pack</h2>
          <p style="margin:0 0 16px 0;color:#bfbfbf">Hvala! Klikni za preuzimanje.</p>
          <p style="margin:16px 0">
            <a href="${signed.signedUrl}"
               style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
              Preuzmi SFX.zip
            </a>
          </p>
          <p style="margin:10px 0 0 0;color:#7c7c7c;font-size:12px">Link važi 1 sat.</p>
        </div>
        <p style="max-width:520px;margin:16px auto 0 auto;color:#6b6b6b;font-size:12px;text-align:center">
          Janko Visuals Produkcija
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Janko Visuals" <${GMAIL_ADDRESS}>`,
      to: email,
      subject: 'SFX Sound Pack – download link',
      html,
      replyTo: GMAIL_ADDRESS,
    });

    log('done', { ms: Date.now() - t0, email, resourceSlug });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[sendResource] fatal', err);
    return res.status(500).json({ error: 'Došlo je do greške.', details: err?.message });
  }
}
