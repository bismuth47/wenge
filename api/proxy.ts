/**
 * GET /api/proxy?url=https://example.com
 *  - Fetches the target URL, strips X-Frame-Options / CSP frame-ancestors
 *    and injects <base href> so relative links resolve.
 *  - If ?probe=1 is present, only inspects headers and returns JSON { blocked, headers }
 *  Security:
 *  - Only http/https allowed, length limit 2048
 *  - Blocks private / loopback / metadata IPs by hostname pattern
 *  - Timeout 10s, max body 3MB
 */

function isBlockedByHeaders(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options");
  if (xfo) {
    const v = xfo.toLowerCase().trim();
    if (v === "deny" || v === "sameorigin" || v.includes("allow-from")) return true;
  }
  const csp = headers.get("content-security-policy") || headers.get("content-security-policy-report-only");
  if (csp) {
    const lower = csp.toLowerCase();
    // frame-ancestors 'none' or 'self' without our origin => blocked
    if (lower.includes("frame-ancestors")) {
      // naive: if it contains frame-ancestors and does not allow *
      if (lower.includes("frame-ancestors 'none'") || lower.includes("frame-ancestors 'self'")) return true;
      // if it restricts to specific origins, still blocked for iframe
      if (!lower.includes("frame-ancestors *") && !lower.includes("frame-ancestors https:")) {
        // Check if it explicitly allows any - otherwise consider blocked
        // For safety, treat any frame-ancestors directive as blocked unless it contains *
        const m = lower.match(/frame-ancestors([^;]+)/);
        if (m) {
          const val = m[1].trim();
          if (!val.includes("*")) return true;
        }
      }
    }
  }
  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  if (h.startsWith("127.")) return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (h === "169.254.169.254" || h.startsWith("169.254.")) return true;
  if (h === "metadata.google.internal") return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  return false;
}

function validateUrl(raw: string): { ok: boolean; url?: URL; error?: string } {
  if (!raw || typeof raw !== "string") return { ok: false, error: "url required" };
  if (raw.length > 2048) return { ok: false, error: "url too long" };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "invalid url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "only http/https allowed" };
  }
  if (isPrivateHostname(parsed.hostname)) {
    return { ok: false, error: "private address blocked" };
  }
  // Block non-standard ports to reduce SSRF surface (allow 80,443 and 3000-9000)
  // We allow standard ports; for now allow any but could restrict.
  return { ok: true, url: parsed };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawUrl = (req.query?.url as string) || "";
  const probe = req.query?.probe !== undefined;

  const v = validateUrl(rawUrl);
  if (!v.ok || !v.url) {
    return res.status(400).json({ error: v.error || "invalid url" });
  }
  const target = v.url.toString();

  // Probe mode: HEAD request and header inspection only
  if (probe) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const PC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const headRes = await fetch(target, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": PC_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        },
      }).catch(async () => {
        // Some servers don't support HEAD, fallback to GET with range
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 5000);
        const r = await fetch(target, {
          method: "GET",
          redirect: "follow",
          signal: c2.signal,
          headers: { "User-Agent": PC_UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "ja,en-US;q=0.9,en;q=0.8", Range: "bytes=0-1023" },
        });
        clearTimeout(t2);
        return r;
      });
      clearTimeout(t);
      const blocked = isBlockedByHeaders(headRes.headers);
      return res.status(200).json({
        blocked,
        status: headRes.status,
        contentType: headRes.headers.get("content-type") || "",
        xFrameOptions: headRes.headers.get("x-frame-options") || null,
        csp: headRes.headers.get("content-security-policy") || null,
        finalUrl: headRes.url || target,
      });
    } catch (e: any) {
      // If probe fails, assume not blocked but report error; frontend will try direct
      return res.status(200).json({ blocked: false, probeError: e?.message || String(e), finalUrl: target });
    }
  }

  // Normal proxy mode
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const upstream = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // PC風に偽装: DuckDuckGoのBot判定「If this persists...」を回避
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(upstream.status).send(text || `Upstream error ${upstream.status}`);
    }

    const contentType = upstream.headers.get("content-type") || "text/html";
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");

    // Strip framing headers, add CORS + COOP/COEP permissive
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    // Explicitly remove CSP that would block; we set permissive
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.removeHeader?.("Cross-Origin-Opener-Policy-Report-Only");
    res.removeHeader?.("Cross-Origin-Embedder-Policy-Report-Only");

    if (!isHtml) {
      // For non-HTML (images, etc.) stream bytes
      res.setHeader("Content-Type", contentType);
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > 3 * 1024 * 1024) {
        return res.status(413).json({ error: "content too large" });
      }
      const disp = upstream.headers.get("content-disposition");
      if (disp) res.setHeader("Content-Disposition", disp);
      return res.status(200).send(buf);
    }

    // HTML handling
    let html = await upstream.text();
    if (html.length > 3 * 1024 * 1024) {
      html = html.slice(0, 3 * 1024 * 1024);
    }

    // --- HTML sanitization for iframe embedding (no full-proxy) ---
    // 1) Remove meta http-equiv CSP / X-Frame-Options that would re-block inside frame
    html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "");
    html = html.replace(/<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, "");

    // 2) Inject <base href> for relative URL resolution (subresources remain direct via base)
    const baseHref = upstream.url || target;
    const baseTag = `<base href="${baseHref}">`;
    // Anti frame-busting script: neutralize top/parent checks without breaking page
    const antiBustScript = `<script>try{window.top=window.self;window.parent=window.self;Object.defineProperty(window,'top',{get:()=>window.self,configurable:true});Object.defineProperty(window,'parent',{get:()=>window.self,configurable:true});}catch(e){}</script>`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}\n${antiBustScript}`);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${baseTag}\n${antiBustScript}</head>`);
    } else {
      html = `${baseTag}\n${antiBustScript}\n${html}`;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Cache for 60s at CDN (HTML only)
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    return res.status(200).send(html);
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "upstream timeout" : e?.message || String(e);
    return res.status(502).json({ error: msg, url: target });
  }
}

export const config = {
  api: { bodyParser: false },
};
