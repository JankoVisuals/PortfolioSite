// /api/sendResource.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

type MapEntry = { filename: string };

// --- helper: bezbedno čitanje ENV-a
function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// --- helper: izvuci IP i user-agent (korisno za log)
function getClientMeta(req: VercelRequest) {
  const ua = (req.headers['user-agent'] as string) || null;
  const ip =
    ((req.headers['x-forwarded-for'] as string)?.split(',')[0] || '').trim() ||
    (req.socket?.remoteAddress as string) ||
    null;
  return { ua, ip };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Dozvoli samo POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const start = Date.now();
  const log = (msg: string, extra?: any) =>
    console.log(`[sendResource] ${msg}`, extra ?? '');

  try {
    const { email, resource } = (req.body as any) ?? {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email je obavezan.' });
    }

    // --- Mapiranje resursa -> fajl u bucketu (za sada samo SFX.zip)
    const MAP: Record<string, MapEntry> = {
      sfx: { filename: 'SFX.zip' },
      // kasnije: hookovi:{ filename:'hookovi.pdf' }, presets:{ filename:'presets.zip' }, lut:{ filename:'lut.cube' }
    };
    const picked = MAP[resource || 'sfx'] || MAP.sfx;
    const filename = picked.filename;
    const resourceSlug = resource || 'sfx';

    // --- Supabase
    const SUPABASE_URL = mustGet('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = mustGet('SUPABASE_SERVICE_ROLE_KEY');
    const BUCKET = process.env.SUPABASE_BUCKET_RESOURCES || 'resources';

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) generiši potpisani link
    const { data: signed, error: signErr } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(filename, 60 * 60); // 1h

    if (signErr || !signed?.signedUrl) {
      log('signed url error', signErr ?? {});
      return res.status(500).json({ error: 'Neuspeh pri generisanju linka za preuzimanje.' });
    }

    // 2) upiši zahtev u log tabelu (ne blokira slanje emaila ako padne)
    const { ua, ip } = getClientMeta(req);
    try {
      await sb.from('resource_requests').insert({
        email,
        resource_slug: resourceSlug,
        filename,
        user_agent: ua,
        ip,
        created_at: new Date().toISOString(), // ako kolona ima default, Supabase će ignorisati
      });
    } catch (e) {
      log('insert non-blocking error', (e as Error).message);
    }

    // 3) Pošalji email preko Gmail-a (App Password)
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
          <p style="margin:0 0 16px 0;color:#bfbfbf">Hvala na interesovanju! Klikni na dugme ispod da preuzmeš fajl.</p>
          <p style="margin:16px 0">
            <a href="${signed.signedUrl}"
               style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
              Preuzmi SFX.zip
            </a>
          </p>
          <p style="margin:10px 0 0 0;color:#7c7c7c;font-size:12px">Link važi 1 sat od trenutka slanja.</p>
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

    log('done', { ms: Date.now() - start, email, resourceSlug });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[sendResource] fatal', err);
    const message = err?.message || 'Internal error';
    // Daj korisniku neutralnu poruku, detalje vidiš u Runtime Logs
    return res.status(500).json({ error: 'Došlo je do greške. Pokušaj ponovo.' , debug: message });
  }
}
