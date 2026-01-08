// /api/listVideos.ts
// Vraća signed URL-ove za portfolio videe (radi i kada je bucket PRIVATE).
export const config = { runtime: "nodejs" };

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  // Ako želiš da forsiraš bucket, setuj VIDEOS_BUCKET u Vercel env.
  VIDEOS_BUCKET,
} = process.env;

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

async function findVideoBucket(
  supabase: ReturnType<typeof createClient>,
  max: number,
  preferredBucket?: string
) {
  const buckets = await supabase.storage.listBuckets();
  if (buckets.error) throw buckets.error;

  const allBuckets = (buckets.data || []).map((b) => b.name);
  const candidates = uniq([
    preferredBucket || "",
    "videos",
    "portfolio",
    "reels",
    "media",
    ...allBuckets,
  ]);

  // Nađi prvi bucket koji ima bar jedan od fajlova 1..max
  for (const bucket of candidates) {
    for (let i = 1; i <= max; i++) {
      const probe = await supabase.storage
        .from(bucket)
        .createSignedUrl(`${i}.mp4`, 60);
      if (!probe.error && probe.data?.signedUrl) {
        return bucket;
      }
    }
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send("Server misconfigured: Supabase env vars missing");
    }

    const maxRaw = String(req.query.max || "20");
    const max = Math.max(1, Math.min(50, parseInt(maxRaw, 10) || 20));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const bucket = await findVideoBucket(supabase, max, VIDEOS_BUCKET);
    if (!bucket) {
      return res.status(200).json({ ok: true, items: [] });
    }

    const items: Array<{ fileName: string; url: string }> = [];
    for (let i = 1; i <= max; i++) {
      const fileName = `${i}.mp4`;
      const signed = await supabase.storage.from(bucket).createSignedUrl(fileName, 60 * 60 * 6);
      if (!signed.error && signed.data?.signedUrl) {
        items.push({ fileName, url: signed.data.signedUrl });
      }
    }

    return res.status(200).json({ ok: true, bucket, items });
  } catch (err: any) {
    console.error("[listVideos] Error:", err);
    return res.status(500).send(err?.message || "Internal error");
  }
}
