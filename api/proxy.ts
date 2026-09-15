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
    if (lower.includes("frame-ancestors")) {
      if (lower.includes("frame-ancestors 'none'") || lower.includes("frame-ancestors 'self'")) return true;
      if (!lower.includes("frame-ancestors *") && !lower.includes("frame-ancestors https:")) {
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
  return { ok: true, url: parsed };
}

const PC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function isDuckDuckGoHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "duckduckgo.com" || h === "html.duckduckgo.com" || h === "lite.duckduckgo.com" || h.endsWith(".duckduckgo.com");
}

function buildBrowserHeaders(targetUrl: string): Record<string, string> {
  const isDDG = (() => {
    try { return isDuckDuckGoHostname(new URL(targetUrl).hostname); } catch { return false; }
  })();
  const base: Record<string, string> = {
    "User-Agent": PC_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (isDDG) {
    base["Referer"] = "https://html.duckduckgo.com/";
    base["Sec-Fetch-Site"] = "same-origin";
  }
  return base;
}

function isDuckDuckGoHtmlRequest(urlStr: string): { isDDGHtml: boolean; query: string | null } {
  try {
    const u = new URL(urlStr);
    if (!isDuckDuckGoHostname(u.hostname)) return { isDDGHtml: false, query: null };
    if (!u.pathname.startsWith("/html")) return { isDDGHtml: false, query: null };
    const q = u.searchParams.get("q");
    return { isDDGHtml: !!q, query: q };
  } catch {
    return { isDDGHtml: false, query: null };
  }
}

function isBotBlockedBody(html: string, status: number): { blocked: boolean; code: string | null } {
  if (status === 202) return { blocked: true, code: "202" };
  const lower = html.toLowerCase();
  if (lower.includes("if this persists") && lower.includes("anonymized")) {
    const m = html.match(/error-lite\+[^\s"'<]+/i);
    return { blocked: true, code: m ? m[0] : "anonymized" };
  }
  if (lower.includes("bots use duckduckgo") || lower.includes("please complete the following challenge")) {
    return { blocked: true, code: "challenge" };
  }
  if (lower.includes("unfortunately, bots") || lower.includes("anomaly detected")) {
    return { blocked: true, code: "anomaly" };
  }
  return { blocked: false, code: null };
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

  // Probe mode: avoid HEAD/Range for DDG (bot signal), use GET with browser headers
  if (probe) {
    try {
      const isDDG = isDuckDuckGoHostname(v.url.hostname);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      // DDG: use GET directly with full headers; others: try HEAD then fallback GET
      let headRes: Response;
      if (isDDG) {
        const headers = buildBrowserHeaders(target);
        headRes = await fetch(target, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { ...headers, Range: "bytes=0-4096" },
        });
      } else {
        const headers = buildBrowserHeaders(target);
        headRes = await fetch(target, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
          headers,
        }).catch(async () => {
          const c2 = new AbortController();
          const t2 = setTimeout(() => c2.abort(), 5000);
          const r = await fetch(target, {
            method: "GET",
            redirect: "follow",
            signal: c2.signal,
            headers: { ...headers, Range: "bytes=0-1023" },
          });
          clearTimeout(t2);
          return r;
        });
      }
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
      return res.status(200).json({ blocked: false, probeError: e?.message || String(e), finalUrl: target });
    }
  }

  // Normal proxy mode
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // For DDG HTML ?q=, use POST with form body (more reliable than GET)
    const ddg = isDuckDuckGoHtmlRequest(target);
    let fetchUrl = target;
    let fetchInit: RequestInit = {
      redirect: "follow",
      signal: controller.signal,
      headers: buildBrowserHeaders(target),
    };

    if (ddg.isDDGHtml && ddg.query) {
      // Switch to POST https://html.duckduckgo.com/html/ with q
      const u = new URL(target);
      fetchUrl = `${u.protocol}//${u.host}/html/`;
      const body = new URLSearchParams();
      body.set("q", ddg.query);
      // minimal form fields to look like real submission
      body.set("b", "");
      body.set("kl", "wt-wt");
      const headers = buildBrowserHeaders(fetchUrl);
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Origin"] = "https://html.duckduckgo.com";
      headers["Referer"] = "https://html.duckduckgo.com/";
      fetchInit = {
        redirect: "follow",
        signal: controller.signal,
        method: "POST",
        headers,
        body: body.toString(),
      };
    }

    const upstream = await fetch(fetchUrl, fetchInit as any);
    clearTimeout(timeout);

    // Check upstream status before body read - but also need body check for 200-blocked pages
    const contentType = upstream.headers.get("content-type") || "text/html";
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");

    // Strip framing headers, add CORS permissive
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.removeHeader?.("Cross-Origin-Opener-Policy-Report-Only");
    res.removeHeader?.("Cross-Origin-Embedder-Policy-Report-Only");

    if (!isHtml) {
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        return res.status(upstream.status).send(text || `Upstream error ${upstream.status}`);
      }
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

    // DDG bot-blocked page is 200/202 with challenge body -> detect and return JSON instead of HTML
    const botCheck = isBotBlockedBody(html, upstream.status);
    if (botCheck.blocked) {
      res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      // Try to extract anonymized email/code for debugging
      const emailMatch = html.match(/[a-z0-9._%+-]+\+[^@\s]+@duckduckgo\.com/i);
      const liteMatch = html.match(/error-lite\+[^\s"'<]+/i);
      return res.status(502).json({
        error: "duckduckgo bot blocked",
        botBlocked: true,
        code: botCheck.code || liteMatch?.[0] || null,
        email: emailMatch?.[0] || null,
        status: upstream.status,
        url: target,
        fetchUrl,
        hint: "Vercel IP/TLS blocked. Will fallback inside Win95 window (Bing/Wikipedia).",
      });
    }

    if (!upstream.ok) {
      // Non-bot error but HTML error page
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(upstream.status).send(html || `Upstream error ${upstream.status}`);
    }

    // --- HTML sanitization for iframe embedding ---
    html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "");
    html = html.replace(/<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, "");

    const baseHref = upstream.url || fetchUrl || target;
    const baseTag = `<base href="${baseHref}">`;
    // Frame-bust無力化 + 全リンク/window.open横取り → 親(Wenge IE)にpostMessage通知。
    // 実機ブラウザへの飛び出し(target=_blank/window.open)をpreventDefault相当で阻止する。
    // 注意: window.parentをselfに偽装する前に実親への参照を保持し、通知にはそれを使う。
    const antiBustScript = `<script>(function(){var __wp=null;try{__wp=window.parent;}catch(e){}try{window.top=window.self;Object.defineProperty(window,'top',{get:function(){return window.self;},configurable:true});}catch(e){}function __abs(h){try{return new URL(h,document.baseURI).toString();}catch(e){return null;}}function __send(url,tg,kind){if(!url)return;if(/^(javascript|data|blob|mailto|tel):/i.test(url))return;if(url.charAt(0)==='#')return;try{var p=__wp||window.parent;if(p&&p.postMessage){p.postMessage({type:'wenge-ie-navigate',url:url,target:tg||'_self',kind:kind||'link'},'*');}}catch(e){}}function __isNew(a,e){try{if(e&&(e.ctrlKey||e.metaKey))return true;if(e&&e.button===1)return true;}catch(err){}try{var t=(a.getAttribute('target')||'').toLowerCase();if(t==='_blank')return true;}catch(err){}return false;}document.addEventListener('click',function(e){try{var el=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!el)return;var u=__abs(el.getAttribute('href'));if(!u||!/^https?:/i.test(u))return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation){e.stopImmediatePropagation();}__send(u,__isNew(el,e)?'_blank':'_self','link');}catch(err){}},true);document.addEventListener('auxclick',function(e){try{if(e.button!==1)return;var el=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!el)return;var u=__abs(el.getAttribute('href'));if(!u||!/^https?:/i.test(u))return;e.preventDefault();e.stopPropagation();__send(u,'_blank','link');}catch(err){}},true);document.addEventListener('submit',function(e){try{var f=e.target;if(!f||f.tagName!=='FORM')return;e.preventDefault();e.stopPropagation();var u=__abs(f.getAttribute('action')||document.baseURI);if(!u||!/^https?:/i.test(u))return;var tg='';try{tg=(f.getAttribute('target')||'').toLowerCase();}catch(err){}__send(u,tg==='_blank'?'_blank':'_self','form');}catch(err){}},true);try{window.open=function(url){try{var u=__abs(url||'');if(u&&/^https?:/i.test(u)){__send(u,'_blank','window.open');}}catch(err){}return null;};}catch(e){}try{var b=document.querySelector('base[target]');if(b)b.removeAttribute('target');}catch(e){}try{document.addEventListener('contextmenu',function(e){e.preventDefault();e.stopPropagation();},true);document.addEventListener('DOMContentLoaded',function(){try{document.addEventListener('contextmenu',function(e){e.preventDefault();e.stopPropagation();},true);}catch(e){}try{var bb=document.querySelector('base[target]');if(bb)bb.removeAttribute('target');}catch(e){}});}catch(e){}})();</script>`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}\n${antiBustScript}`);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${baseTag}\n${antiBustScript}</head>`);
    } else {
      html = `${baseTag}\n${antiBustScript}\n${html}`;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
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
