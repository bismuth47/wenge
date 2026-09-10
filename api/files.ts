import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

// Vercel serverless handler supporting List / Upload (multipart) / Presigned URL
export default async function handler(req: any, res: any) {
  const r2 = getR2();

  if (req.method === "GET") {
    const prefix = (req.query?.prefix as string) || "";
    if (!r2) {
      return res.status(200).json({ files: [], note: "R2 not configured" });
    }
    const cmd = new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: prefix, MaxKeys: 100 });
    const out = await r2.client.send(cmd);
    const files = (out.Contents || []).map((o) => ({
      key: o.Key,
      size: o.Size,
      uploadedAt: o.LastModified?.toISOString(),
      url: `${process.env.R2_PUBLIC_URL || ""}/${o.Key}`.replace("//", "/").replace("https:/", "https://"),
    }));
    // If R2_PUBLIC_URL not set, generate signed URLs for 1h
    if (!process.env.R2_PUBLIC_URL) {
      for (const f of files) {
        try {
          f.url = await getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: f.key! }), { expiresIn: 3600 });
        } catch {}
      }
    }
    return res.status(200).json({ files });
  }

  if (req.method === "POST") {
    // Expect multipart/form-data; Vercel body parsing disabled for files.
    // Simple handling: if r2 not configured, echo success for local fallback
    if (!r2) {
      return res.status(200).json({ ok: true, note: "R2 not configured, client should fallback to localStorage" });
    }
    // For simplicity, use busboy or rely on Vercel's default parsing? We implement raw parsing
    // Easier: expect JSON with { key, contentType } for presigned URL flow
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (body?.presign) {
      const key = body.key;
      const url = await getSignedUrl(r2.client, new PutObjectCommand({ Bucket: r2.bucket, Key: key, ContentType: body.contentType || "application/octet-stream" }), { expiresIn: 3600 });
      return res.status(200).json({ url, key });
    }
    // If multipart, we fallback to error with instructions
    return res.status(400).json({ error: "Use presign flow: POST { presign:true, key, contentType } then PUT to url, or configure multipart parser" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};
