import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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

type R2Ctx = NonNullable<ReturnType<typeof getR2>>;

async function withUrls(r2: R2Ctx, contents: { Key?: string; Size?: number; LastModified?: Date }[]) {
  const files = (contents || [])
    .filter((o) => o.Key && !(o.Key.endsWith("/") && (o.Size ?? 0) === 0))
    .map((o) => ({
      key: o.Key!,
      size: o.Size ?? 0,
      uploadedAt: o.LastModified?.toISOString() ?? new Date(0).toISOString(),
      url: `${process.env.R2_PUBLIC_URL || ""}/${o.Key}`.replace("//", "/").replace("https:/", "https://"),
    }));
  if (!process.env.R2_PUBLIC_URL) {
    for (const f of files) {
      try {
        f.url = await getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: f.key }), { expiresIn: 3600 });
      } catch {}
    }
  }
  return files;
}

// Vercel serverless handler supporting List (folder-aware) / Upload presign / mkdir / Delete
export default async function handler(req: any, res: any) {
  const r2 = getR2();

  if (req.method === "GET") {
    const rawPrefix = (req.query?.prefix as string) || "";
    const delimiter = (req.query?.delimiter as string) ?? "/";
    const flat = req.query?.flat === "1";
    // Folder navigation always uses trailing-slash prefixes ("", "photos/")
    let prefix = rawPrefix.replace(/^\/+/, "");
    if (!flat && delimiter && prefix && !prefix.endsWith("/")) prefix += "/";
    if (!r2) {
      return res.status(200).json({ files: [], folders: [], note: "R2 not configured" });
    }
    try {
      if (flat || !delimiter) {
        // Backward compat for FileShare: flat list (no delimiter)
        const cmd = new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: prefix, MaxKeys: 1000 });
        const out = await r2.client.send(cmd);
        const files = await withUrls(r2, out.Contents || []);
        return res.status(200).json({ files, folders: [] });
      }
      const cmd = new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: prefix, Delimiter: delimiter, MaxKeys: 1000 });
      const out = await r2.client.send(cmd);
      // Sub folders from CommonPrefixes
      const folders = (out.CommonPrefixes || [])
        .map((p) => p.Prefix || "")
        .filter(Boolean)
        .map((p) => p.slice(prefix.length).replace(/\/$/, ""))
        .filter(Boolean);
      // Files directly under this prefix (exclude folder placeholders themselves
      // and deeper keys — Delimiter already does this, but filter defensively)
      const contents = (out.Contents || []).filter((o) => {
        if (!o.Key || o.Key === prefix) return false;
        const rest = o.Key.slice(prefix.length);
        if (!rest || rest.includes("/")) return false;
        // Hide 0-byte folder placeholder objects (e.g. "a/.keep" style is kept,
        // but "a/" itself is hidden since it duplicates the folder row)
        if (rest === "" || o.Key.endsWith("/") && (o.Size ?? 0) === 0) return false;
        return true;
      });
      const files = await withUrls(r2, contents);
      return res.status(200).json({ files, folders, prefix });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "R2 list failed" });
    }
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
      const key = String(body.key || "").replace(/^\/+/, "");
      if (!key) return res.status(400).json({ error: "key is required" });
      const url = await getSignedUrl(r2.client, new PutObjectCommand({ Bucket: r2.bucket, Key: key, ContentType: body.contentType || "application/octet-stream" }), { expiresIn: 3600 });
      return res.status(200).json({ url, key });
    }
    // If multipart, we fallback to error with instructions
    if (body?.mkdir) {
      const rawKey = String(body.key || body.prefix || "");
      const folder = rawKey.replace(/^\/+/, "").replace(/\/*$/, "") + "/";
      if (!folder || folder === "/") return res.status(400).json({ error: "key (folder name) is required" });
      // R2 has no real folders: create a 0-byte placeholder so the prefix shows up
      await r2.client.send(new PutObjectCommand({ Bucket: r2.bucket, Key: folder, Body: new Uint8Array(0), ContentType: "application/x-directory" }));
      return res.status(200).json({ ok: true, key: folder });
    }
    return res.status(400).json({ error: "Use presign flow: POST { presign:true, key, contentType } then PUT to url, or { mkdir:true, key } for folders" });
  }

  if (req.method === "DELETE") {
    if (!r2) return res.status(400).json({ error: "R2 not configured" });
    const rawKey = String(req.query?.key || "");
    const key = rawKey.replace(/^\/+/, "");
    if (!key) return res.status(400).json({ error: "key is required" });
    try {
      if (key.endsWith("/")) {
        // Recursive folder delete (cap at 1000 objects)
        const list = await r2.client.send(new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: key, MaxKeys: 1000 }));
        const targets = (list.Contents || []).map((o) => o.Key!).filter(Boolean);
        if (targets.length > 0) {
          await r2.client.send(new DeleteObjectsCommand({ Bucket: r2.bucket, Delete: { Objects: targets.map((Key) => ({ Key })) } }));
        } else {
          await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
        }
      } else {
        await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
      }
      return res.status(200).json({ ok: true, key });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "R2 delete failed" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};
