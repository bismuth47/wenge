import { useCallback, useEffect, useRef, useState } from "react";
import { Button, TextInput, ProgressBar, Anchor, Frame, MenuList, MenuListItem, Separator } from "react95";
import { showError } from "../components/SystemDialog";
import { getVfsDirByExt } from "../lib/downloadTarget";
import { saveUrlToVfs } from "../lib/vfs/download";
import type { VfsFile } from "../lib/vfs/types";
import { consumePendingVfsFile } from "../lib/vfs/openWith";

const QUICK_LINKS = [
  "https://www.bing.com/",
  "https://ja.wikipedia.org/",
  "https://example.com",
  "https://www.wikipedia.org",
];

function normalizeUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    s = "https://" + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function isProbablyUrl(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/\s/.test(s)) return false; // 空白含む→検索ワード
  if (/^localhost(:\d+)?(\/|$)/i.test(s)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(s)) return true;
  if (!s.includes(".")) return false;
  return /^[^\s]+\.[^\s]+/.test(s);
}

function toDuckDuckGoUrl(query: string): string {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`;
}
function toBingUrl(query: string): string {
  return `https://www.bing.com/search?q=${encodeURIComponent(query.trim())}`;
}
function toWikipediaUrl(query: string): string {
  return `https://ja.wikipedia.org/w/index.php?search=${encodeURIComponent(query.trim())}&ns0=1`;
}

function fileNameForSave(pageUrl: string, disposition: string | null): string {
  // Prefer the server's suggested filename when present
  if (disposition) {
    const m = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i);
    if (m) {
      try {
        const decoded = decodeURIComponent(m[1].replace(/^"|"$/g, "").trim());
        if (decoded) return decoded;
      } catch {}
    }
  }
  try {
    const u = new URL(pageUrl);
    const base = u.pathname.split("/").filter(Boolean).pop() || "";
    if (base && base.includes(".")) return base;
    if (base) return `${base}.html`;
    return `${u.hostname}.html`;
  } catch {
    return "download.html";
  }
}

type BlockInfo = { query: string; code: string | null; email: string | null; originalUrl: string };

export function InternetExplorerApp({ file }: { file?: VfsFile | null }) {
  const [address, setAddress] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [hIndex, setHIndex] = useState(-1);
  const hIndexRef = useRef(-1);
  const currentUrlRef = useRef("");
  useEffect(() => {
    currentUrlRef.current = currentUrl;
  }, [currentUrl]);
  // 全サイトをプロキシ経由で表示する (直接表示は廃止: 右クリック横取り・XFO/CSP回避のため)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("準備完了 - URLまたは検索ワードを入力してください");
  const [ddgBlocked, setDdgBlocked] = useState<BlockInfo | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [vfsHtml, setVfsHtml] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Wenge内右クリックメニュー (Win95風)。iframe内のcontextmenuを横取りして表示する。
  type IeMenuState = { x: number; y: number; linkUrl?: string | null; imgUrl?: string | null; selText?: string | null };
  const [ieMenu, setIeMenu] = useState<IeMenuState | null>(null);
  const ieRootRef = useRef<HTMLDivElement>(null);
  const ctxCleanupRef = useRef<(() => void) | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    hIndexRef.current = hIndex;
  }, [hIndex]);

  useEffect(() => {
    const pending = file ?? consumePendingVfsFile();
    if (!pending?.blob) return;
    const url = URL.createObjectURL(pending.blob);
    blobUrlRef.current = url;
    pending.blob.text().then((text) => {
      setVfsHtml(text);
      setCurrentUrl("");
      setAddress(pending.name);
      setStatusText(`VFS: ${pending.name}`);
    }).catch(() => {
      setError("HTMLファイルの読み込みに失敗しました。");
    });
    return () => {
      URL.revokeObjectURL(url);
      if (blobUrlRef.current === url) blobUrlRef.current = null;
    };
  }, [file]);

  const iframeSrc = vfsHtml
    ? "about:blank"
    : currentUrl
      ? `/api/proxy?url=${encodeURIComponent(currentUrl)}`
      : "about:blank";

  useEffect(() => {
    if (!vfsHtml) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = vfsHtml;
  }, [vfsHtml]);

  // Check proxy response for DDG bot block before committing iframe
  const checkDdgBlocked = useCallback(async (proxyUrl: string): Promise<{ blocked: boolean; code: string | null; email: string | null }> => {
    try {
      const res = await fetch(proxyUrl);
      // Proxy returns 502 JSON when blocked
      if (res.status === 502) {
        const j = await res.json().catch(() => null);
        if (j?.botBlocked) return { blocked: true, code: j.code || null, email: j.email || null };
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json().catch(() => null);
        if (j?.botBlocked) return { blocked: true, code: j.code || null, email: j.email || null };
      }
      // If HTML but contains block markers (fallback when proxy didn't catch)
      if (ct.includes("text/html")) {
        const t = await res.text();
        const low = t.toLowerCase();
        if (low.includes("if this persists") && low.includes("anonymized")) {
          const m = t.match(/error-lite\+[^\s"'<]+/i);
          return { blocked: true, code: m ? m[0] : "anonymized", email: null };
        }
      }
      return { blocked: false, code: null, email: null };
    } catch {
      return { blocked: false, code: null, email: null };
    }
  }, []);

  const navigateTo = useCallback(
    (raw: string, opts?: { replaceHistory?: boolean; forceProxy?: boolean }) => {
      void opts;
      const trimmed = raw.trim();
      if (!trimmed) {
        setError("URLまたは検索ワードを入力してください。");
        setStatusText("Navigation canceled");
        return;
      }

      let targetUrl: string;
      let searchQuery: string | null = null;
      if (isProbablyUrl(trimmed)) {
        const normalized = normalizeUrl(trimmed);
        if (!normalized) {
          setError("無効なURLです。http:// または https:// で始まるURLを入力してください。");
          setStatusText("Navigation canceled");
          return;
        }
        targetUrl = normalized;
      } else {
        searchQuery = trimmed;
        // Bingをデフォルト検索に: Vercel IPでDDG htmlは恒久202ブロックのため
        targetUrl = toBingUrl(trimmed);
      }

      setError(null);
      setDdgBlocked(null);
      setFallbackNotice(null);
      setVfsHtml(null);
      setStatusText(`Opening ${targetUrl}...`);
      setLoading(true);

      const curIdx = hIndexRef.current;
      if (!opts?.replaceHistory) {
        setHistoryStack((prev) => {
          const truncated = prev.slice(0, curIdx + 1);
          if (truncated[truncated.length - 1] === targetUrl) return prev;
          const next = [...truncated, targetUrl];
          setHIndex(next.length - 1);
          return next;
        });
      } else {
        setHistoryStack((prev) => {
          const next = [...prev];
          next[curIdx] = targetUrl;
          return next;
        });
      }

      // 全サイトをプロキシ経由で窓内表示。
      // loadingはiframeのonLoad/onErrorまで維持する (同期的にfalseに戻すと
      // 読込中のカーソル・ProgressBar表示が消えてしまう)。
      // 同一URLへの再遷移はsrcが変わらずonLoadが来ないためreloadKeyで強制再マウントする。
      if (targetUrl === currentUrlRef.current) {
        setReloadKey((k) => k + 1);
      }
      currentUrlRef.current = targetUrl;
      setCurrentUrl(targetUrl);
      setAddress(targetUrl);
      if (searchQuery) {
        setStatusText(`Bingで検索(プロキシ経由): ${searchQuery}`);
      } else {
        setStatusText(`互換表示(プロキシ経由)で開いています: ${targetUrl}`);
      }
    },
    [],
  );

  useEffect(() => {
    if (historyStack.length === 0) {
      if (hIndex !== -1) setHIndex(-1);
      return;
    }
    if (hIndex >= historyStack.length) setHIndex(historyStack.length - 1);
    if (hIndex < 0) setHIndex(0);
  }, [historyStack, hIndex]);

  const goBack = () => {
    if (hIndex <= 0) return;
    const nextIdx = hIndex - 1;
    const url = historyStack[nextIdx];
    setHIndex(nextIdx);
    setError(null);
    setDdgBlocked(null);
    setFallbackNotice(null);
    setVfsHtml(null);
    setStatusText(`Opening ${url}...`);
    // onLoadまで維持 (下でfalseに戻さない)
    setLoading(true);
    setCurrentUrl(url);
    setAddress(url);
  };

  const goForward = () => {
    if (hIndex >= historyStack.length - 1) return;
    const nextIdx = hIndex + 1;
    const url = historyStack[nextIdx];
    setHIndex(nextIdx);
    setError(null);
    setDdgBlocked(null);
    setFallbackNotice(null);
    setVfsHtml(null);
    setStatusText(`Opening ${url}...`);
    // onLoadまで維持 (下でfalseに戻さない)
    setLoading(true);
    setCurrentUrl(url);
    setAddress(url);
  };

  const handleRefresh = () => {
    if (!currentUrl) return;
    setError(null);
    setDdgBlocked(null);
    setFallbackNotice(null);
    setLoading(true);
    setStatusText(`Refreshing ${currentUrl}...`);
    setReloadKey((k) => k + 1);
    // onLoadでfalseに戻る
  };

  const [reloadKey, setReloadKey] = useState(0);

  const handleStop = () => {
    setLoading(false);
    setStatusText("Navigation stopped");
    if (iframeRef.current) {
      try {
        iframeRef.current.src = "about:blank";
        setTimeout(() => {
          if (iframeRef.current && currentUrl) iframeRef.current.src = iframeSrc;
        }, 0);
      } catch {}
    }
  };

  const handleGo = () => navigateTo(address);
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") navigateTo(address);
  };

  // onLoadが来ないまま固まった場合の安全弁 (20秒で読込表示・待機カーソルを解除)
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => {
      setLoading(false);
      setStatusText((s) => (s.startsWith("Opening") || s.startsWith("Refreshing") ? `${s} (timed out)` : s));
    }, 20000);
    return () => window.clearTimeout(t);
  }, [loading, currentUrl, reloadKey]);

  // Save the current page to Wenge VFS via /api/proxy
  const handleSave = async () => {
    const target = currentUrl || address.trim();
    if (!target) {
      setError("保存するページを開いてください。");
      return;
    }
    const pageUrl = isProbablyUrl(target) ? normalizeUrl(target) : null;
    if (!pageUrl) {
      setError("保存できるURLではありません。ファイルのURLを開いてから保存してください。");
      return;
    }
    setSaving(true);
    setStatusText(`Saving ${pageUrl} → Wenge...`);
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(pageUrl)}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let msg = `保存に失敗しました (HTTP ${res.status})`;
        try {
          const j = JSON.parse(body);
          if (j?.error) msg = `保存に失敗しました: ${j.error}`;
        } catch {}
        setError(msg);
        setStatusText("Save failed");
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        setError("このページは保存できません（プロキシがブロックを検出）。");
        setStatusText("Save failed");
        return;
      }
      const blob = await res.blob();
      const name = fileNameForSave(pageUrl, res.headers.get("content-disposition"));
      const dir = getVfsDirByExt(name);
      setStatusText(`Document done: ${pageUrl}`);
      await saveUrlToVfs(pageUrl, dir, { filename: name, mime: blob.type || "text/html" });
      setError(null);
    } catch (e: any) {
      setError(`保存に失敗しました: ${e?.message || String(e)}`);
      setStatusText("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const injectCursorStyles = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      return;
    }
    if (!doc) return;
    if (doc.getElementById("w95-iframe-cursors")) return;
    const origin = window.location.origin;
    const style = doc.createElement("style");
    style.id = "w95-iframe-cursors";
    style.textContent = `
      * { cursor: url('${origin}/cursors/arrow.png') 0 0, default !important; }
      a, a[href], button, [role="button"], [onclick], [onmouseover], [onmouseout],
      [onmousedown], [onmouseup], [tabindex]:not([tabindex="-1"]) {
        cursor: url('${origin}/cursors/hand.png') 12 0, pointer !important;
      }
      input[type="text"], input[type="password"], input[type="search"],
      input[type="email"], input[type="url"], input[type="tel"], textarea {
        cursor: url('${origin}/cursors/beam.png') 10 12, text !important;
      }
    `;
    try {
      const head = doc.querySelector("head");
      if (head) {
        head.appendChild(style);
      } else {
        doc.documentElement.appendChild(style);
      }
    } catch {}
  };

  const handleIframeLoad = () => {
    setLoading(false);
    // Detect JSON bot-block rendered inside iframe (fallback for race)
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const txt = doc.body?.innerText || "";
        if (txt.includes("bot blocked") || (txt.includes("If this persists") && txt.includes("anonymized"))) {
          const q = ddgBlocked?.query || address;
          if (q && !isProbablyUrl(q)) {
            setDdgBlocked({ query: q, code: "anonymized", email: null, originalUrl: currentUrl });
            const bingUrl = toBingUrl(q);
            setFallbackNotice("DDGブロックを検出 → Bingで代替表示します（Win95窓内）。");
            setCurrentUrl(bingUrl);
            setAddress(bingUrl);
            return;
          }
        }
      }
    } catch {}
    setStatusText(`互換表示(プロキシ経由): ${currentUrl}`);
    setError(null);

    // Attach link interceptor for VFS downloads (media files, archives, etc.)
    const cleanupClick = attachVfsLinkInterceptor();
    if (cleanupClick) {
      linkInterceptorRef.current = cleanupClick;
    }
    attachIeContextMenu();
    injectCursorStyles();
  };

  const handleIframeError = () => {
    setLoading(false);
    setError("ページの読み込みに失敗しました。別の検索で試してください。");
    setStatusText("Error loading document");
  };

  /** iframe内のDLリンク（拡張子ベース）を横取りしてVFSに保存する */
  const attachVfsLinkInterceptor = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      return;
    }
    if (!doc) return;
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || /^javascript:/i.test(href) || /^data:/i.test(href)) return;
      const isFile = /\.(mp3|wav|ogg|m4a|flac|mp4|webm|zip|rar|7z|pdf|png|jpg|jpeg|gif|bmp|webp|svg|txt|doc|docx|xls|xlsx)$/i.test(href);
      if (!isFile) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const absolute = new URL(href, iframe.contentWindow?.location.href || currentUrl).toString();
        const name = fileNameForSave(absolute, null);
        const dir = getVfsDirByExt(name);
        saveUrlToVfs(absolute, dir, { filename: name }).catch(() => {
          showError("Download", "VFS保存に失敗しました。");
        });
      } catch {
        showError("Download", "リンクの保存に失敗しました。");
      }
    };
    doc.addEventListener("click", onClick, true);
    // cleanup on next navigation
    const cleanup = () => {
      doc.removeEventListener("click", onClick, true);
    };
    return cleanup;
  }, [currentUrl]);

  /** iframe内の右クリックを横取りしてWenge内メニューを出す(プロキシ/srcdocは同一オリジンのため介入可) */
  const attachIeContextMenu = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      // プロキシ経由は同一オリジンのため通常ここには来ない
      return;
    }
    if (!doc) return;
    // 既存の抑止があれば張り替え
    if (ctxCleanupRef.current) {
      try { ctxCleanupRef.current(); } catch {}
      ctxCleanupRef.current = null;
    }
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const el = e.target as Element | null;
        const anchor = el?.closest?.("a[href]") as HTMLAnchorElement | null;
        const img = el?.closest?.("img") as HTMLImageElement | null;
        let linkUrl: string | null = null;
        let imgUrl: string | null = null;
        if (anchor) {
          const href = anchor.getAttribute("href");
          if (href && !/^javascript:/i.test(href) && !/^data:/i.test(href)) {
            try {
              linkUrl = new URL(href, iframe.contentWindow?.location.href || currentUrl).toString();
            } catch { linkUrl = href; }
          }
        }
        if (img) {
          const src = img.getAttribute("src") || img.currentSrc;
          if (src && !src.startsWith("data:")) {
            try {
              imgUrl = new URL(src, iframe.contentWindow?.location.href || currentUrl).toString();
            } catch { imgUrl = src; }
          }
        }
        let selText: string | null = null;
        try {
          const sel = doc!.getSelection?.()?.toString() || iframe.contentWindow?.getSelection?.()?.toString();
          if (sel && sel.trim()) selText = sel.slice(0, 200);
        } catch {}
        // clientX/Yはviewport共通座標なのでそのまま親のfixed配置に使える
        setIeMenu({ x: e.clientX, y: e.clientY, linkUrl, imgUrl, selText });
      } catch {
        setIeMenu({ x: e.clientX, y: e.clientY });
      }
    };
    doc.addEventListener("contextmenu", onCtx, true);
    ctxCleanupRef.current = () => {
      doc.removeEventListener("contextmenu", onCtx, true);
    };
  }, [currentUrl]);

  // Clean up link interceptor when navigating
  const linkInterceptorRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    // Remove previous interceptor
    if (linkInterceptorRef.current) {
      linkInterceptorRef.current();
      linkInterceptorRef.current = null;
    }
    if (ctxCleanupRef.current) {
      try { ctxCleanupRef.current(); } catch {}
      ctxCleanupRef.current = null;
    }
    setIeMenu(null);
    // Attach new one will happen in handleIframeLoad
  }, [currentUrl, vfsHtml]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (linkInterceptorRef.current) {
        linkInterceptorRef.current();
        linkInterceptorRef.current = null;
      }
      if (ctxCleanupRef.current) {
        try { ctxCleanupRef.current(); } catch {}
        ctxCleanupRef.current = null;
      }
    };
  }, []);

  // メニュー表示中の dismiss (Esc / リサイズ)
  useEffect(() => {
    if (!ieMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIeMenu(null); };
    const onResize = () => setIeMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [ieMenu]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusText(`${label}をコピーしました`);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        setStatusText(`${label}をコピーしました`);
      } catch {
        showError("Copy", "コピーに失敗しました。");
      }
    }
    setIeMenu(null);
  };

  // IE枠(ツールバー外・iframe外)の右クリックでもWengeメニューを出す
  const handleIeRootContextMenu = (e: React.MouseEvent) => {
    // iframe内はiframe側リスナーが処理する。ここはiframe外の余白用。
    // iframe上では親にバブリングしないため二重表示にはならない。
    e.preventDefault();
    setIeMenu({ x: e.clientX, y: e.clientY });
  };

  // Fix cursor reset when IE is active - prevent global cursor from overriding
  useEffect(() => {
    if (!currentUrl) return;
    
    const iframe = iframeRef.current;
    if (!iframe) return;
    
    const mouseLeaveHandler = (e: MouseEvent) => {
      // If mouse is leaving the iframe and there's no custom cursor on the iframe,
      // the global cursor hook might try to reset it, which could cause issues
      if (e.relatedTarget && !(e.relatedTarget as Element).closest('iframe')) {
        // Check if IE's injected cursor styles are still in the iframe
        try {
          const doc = iframe.contentDocument;
          if (doc) {
            const style = doc.getElementById('w95-iframe-cursors');
            if (!style) {
              // Re-inject the cursor styles if they were removed
              injectCursorStyles();
            }
          }
        } catch {}
      }
    };
    
    iframe.addEventListener('mouseleave', mouseLeaveHandler);
    
    return () => {
      iframe.removeEventListener('mouseleave', mouseLeaveHandler);
    };
  }, [currentUrl, injectCursorStyles, iframeRef]);

  const canBack = hIndex > 0;
  const canForward = hIndex < historyStack.length - 1;

  const handleFallbackBing = () => {
    if (!ddgBlocked) return;
    const bingUrl = toBingUrl(ddgBlocked.query);
    setFallbackNotice(`Bingで再検索: ${ddgBlocked.query}`);
    navigateTo(bingUrl);
  };
  const handleFallbackWiki = () => {
    if (!ddgBlocked) return;
    const wikiUrl = toWikipediaUrl(ddgBlocked.query);
    setFallbackNotice(`Wikipediaで検索: ${ddgBlocked.query}`);
    navigateTo(wikiUrl);
  };
  const handleRetryDdg = async () => {
    const q = ddgBlocked?.query || address.trim();
    if (!q || isProbablyUrl(q)) return;
    // DDGを明示的に試す（失敗時はproxyが502を返し、checkで検出してBingに留まる）
    const ddgUrl = toDuckDuckGoUrl(q);
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(ddgUrl)}`;
    setFallbackNotice(`DDGを再試行中: ${q}...`);
    const check = await checkDdgBlocked(proxyUrl);
    if (check.blocked) {
      setDdgBlocked({ query: q, code: check.code, email: check.email, originalUrl: ddgUrl });
      setFallbackNotice(`DDGは依然ブロック中 (code: ${check.code || "anonymized"})。Bingで継続します。`);
      return;
    }
    setDdgBlocked(null);
    setFallbackNotice(`DDGで表示: ${q}`);
    navigateTo(ddgUrl);
  };

  return (
    <div ref={ieRootRef} onContextMenu={handleIeRootContextMenu} className={loading ? "w95-ie-loading" : undefined} style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", minHeight: 320 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <Button size="sm" disabled={!canBack} onClick={goBack}>◀ Back</Button>
        <Button size="sm" disabled={!canForward} onClick={goForward}>▶ Forward</Button>
        <Button size="sm" onClick={handleRefresh} disabled={!currentUrl}>Refresh</Button>
        <Button size="sm" onClick={handleStop} disabled={!loading}>Stop</Button>
        <TextInput value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={handleAddressKeyDown} placeholder="URL または検索ワード (例: wenge / example.com)" style={{ flex: 1, minWidth: 160 }} />
        <Button onClick={handleGo} disabled={loading}>Go</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || (!currentUrl && !address.trim())} title="このページをWenge内に保存">Wenge保存</Button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#808080" }}>via /api/proxy (全サイト互換表示)</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>再読込</Button>
        </div>
      </div>

      {loading && <ProgressBar value={60} style={{ height: 12 }} />}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
        <span style={{ fontWeight: "bold" }}>お気に入り:</span>
        {QUICK_LINKS.map((u) => (
          <Anchor key={u} onClick={() => navigateTo(u)} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer", fontSize: 11 }}>{u.replace("https://", "")}</Anchor>
        ))}
        <Anchor onClick={() => navigateTo("https://www.wenge.co.jp/")} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer", fontSize: 11 }}>wenge.co.jp</Anchor>
      </div>

      {fallbackNotice && (
        <Frame variant="well" style={{ background: "#ffffe1", padding: "6px 8px", fontSize: 11, color: "#000080", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>ℹ {fallbackNotice}</span>
          <Button size="sm" onClick={() => setFallbackNotice(null)}>閉じる</Button>
        </Frame>
      )}

      {ddgBlocked && (
        <Frame variant="well" style={{ background: "#c0c0c0", padding: 8, display: "flex", flexDirection: "column", gap: 6, border: "2px inset #fff" }}>
          <div style={{ fontSize: 11, fontWeight: "bold", color: "#000080", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>⚠</span> DuckDuckGo が一時的にブロックされました
            {ddgBlocked.code && <span style={{ fontWeight: "normal", color: "#800000", fontSize: 10 }}>code: {ddgBlocked.code.slice(0, 40)}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#000", lineHeight: 1.4, background: "#fff", border: "2px inset #fff", padding: 6 }}>
            検索 <b>{ddgBlocked.query}</b> は DuckDuckGo 側のボット判定（<code>If this persists… anonymized</code>）でブロックされました。<br />
            VercelのデータセンターIP/TLSが原因で、ヘッダ偽装だけでは回避できない場合があります。<br />
            <b>Win95窓内で代替検索を表示しています。</b> 外部ブラウザには遷移しません。
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Button size="sm" onClick={handleRetryDdg}>DDGを再試行</Button>
            <Button size="sm" onClick={handleFallbackBing}>Bingで検索（窓内）</Button>
            <Button size="sm" onClick={handleFallbackWiki}>Wikipediaで検索（窓内）</Button>
            <Button size="sm" onClick={() => { setDdgBlocked(null); setFallbackNotice(null); }}>閉じる</Button>
          </div>
          <div style={{ fontSize: 10, color: "#808080" }}>現在は Bing 結果をプロキシ経由で表示中。アドレスバーのURLは窓内で切り替え可能です。</div>
        </Frame>
      )}

      {error && !ddgBlocked && (
        <Frame variant="well" style={{ background: "#ffffe1", padding: "6px 8px", fontSize: 11, color: "#800000", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>⚠ {error}</span>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>再読込</Button>
          </div>
        </Frame>
      )}

      <div style={{ flex: 1, minHeight: 260, background: "#fff", border: "2px inset #fff", padding: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {(currentUrl || vfsHtml) ? (
          <div style={{ flex: 1, position: "relative", background: "#fff", overflow: "hidden", display: "flex" }}>
            <iframe
              key={`${iframeSrc}::${reloadKey}::${hIndex}::proxy`}
              ref={iframeRef}
              src={iframeSrc}
              title="Wenge IE"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
              allow="fullscreen; autoplay; clipboard-read; clipboard-write"
              style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
            {loading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)", display: "grid", placeItems: "center", fontSize: 11, color: "#000080", flexDirection: "column", gap: 6 }}>
                <div>Loading {currentUrl}...</div>
                {ddgBlocked && <div style={{ fontSize: 10, color: "#808080" }}>DDGブロック検出時はBingに自動切替します</div>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#008080", padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", textShadow: "1px 1px 0 #000" }}>Internet Explorer</div>
            <div style={{ fontSize: 11, color: "#fff", textShadow: "1px 1px 0 #000", lineHeight: 1.5 }}>
              Enter URL or search word and click <b>Go</b> or press <b>Enter</b> to open.<br />
              Search words are displayed in Bing window.
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <Button size="sm" onClick={() => navigateTo("https://www.bing.com/")}>Bing Home</Button>
              <Button size="sm" onClick={() => navigateTo("https://ja.wikipedia.org/")}>Wikipedia</Button>
              <Button size="sm" onClick={() => navigateTo("https://example.com")}>example.com</Button>
            </div>
            <div style={{ fontSize: 10, color: "#c0c0c0", textShadow: "1px 1px 0 #000" }}>Tip: Enter example.com</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, background: "#c0c0c0", border: "2px inset", padding: "2px 6px", display: "flex", justifyContent: "space-between", gap: 8, overflow: "hidden" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUrl ? statusText : "準備完了"}</span>
        <span style={{ flexShrink: 0, color: "#808080" }}>{currentUrl ? "Proxy" : "0 pages"} | {historyStack.length} pages</span>
      </div>

      <div style={{ fontSize: 10, color: "#808080", lineHeight: 1.4 }}></div>

      {/* Wenge内右クリックメニュー (実機メニューの代わり・Win95風) */}
      {ieMenu && (
        <>
          <div
            onClick={() => setIeMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setIeMenu(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 9990, background: "transparent" }}
          />
          <div
            style={{
              position: "fixed",
              // カーソルの右側に開く (実機同様)。右端・下端では画面内に収まるよう反転する。
              left: (() => {
                const w = 264;
                const right = ieMenu.x + 2;
                if (right + w <= window.innerWidth) return Math.max(4, right);
                return Math.max(4, ieMenu.x - w);
              })(),
              top: (() => {
                const h = 330;
                const below = ieMenu.y + 2;
                if (below + h <= window.innerHeight) return Math.max(4, below);
                return Math.max(4, window.innerHeight - h);
              })(),
              zIndex: 9991,
              minWidth: 210,
              maxWidth: 260,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <MenuList style={{ width: "100%" }}>
              <MenuListItem
                disabled={!canBack}
                onClick={() => { setIeMenu(null); goBack(); }}
                style={{ fontSize: 11 }}
              >
                ◀ 戻る
              </MenuListItem>
              <MenuListItem
                disabled={!canForward}
                onClick={() => { setIeMenu(null); goForward(); }}
                style={{ fontSize: 11 }}
              >
                ▶ 進む
              </MenuListItem>
              <MenuListItem
                disabled={!currentUrl && !vfsHtml}
                onClick={() => { setIeMenu(null); handleRefresh(); }}
                style={{ fontSize: 11 }}
              >
                ↻ 再読込
              </MenuListItem>
              <Separator />
              {ieMenu.linkUrl && (
                <MenuListItem
                  onClick={() => { const u = ieMenu.linkUrl!; setIeMenu(null); navigateTo(u); }}
                  style={{ fontSize: 11 }}
                >
                  新しいウィンドウで開く (Wenge IE)
                </MenuListItem>
              )}
              {ieMenu.linkUrl && (
                <MenuListItem onClick={() => copyText(ieMenu.linkUrl!, "リンクURL")} style={{ fontSize: 11 }}>
                  リンクのURLをコピー
                </MenuListItem>
              )}
              {ieMenu.imgUrl && !ieMenu.linkUrl && (
                <MenuListItem onClick={() => copyText(ieMenu.imgUrl!, "画像URL")} style={{ fontSize: 11 }}>
                  画像のURLをコピー
                </MenuListItem>
              )}
              {ieMenu.imgUrl && !ieMenu.linkUrl && (
                <MenuListItem
                  onClick={() => {
                    const u = ieMenu.imgUrl!;
                    setIeMenu(null);
                    const name = fileNameForSave(u, null);
                    saveUrlToVfs(u, getVfsDirByExt(name), { filename: name }).catch(() => {
                      showError("Download", "VFS保存に失敗しました。");
                    });
                  }}
                  style={{ fontSize: 11 }}
                >
                  画像をWengeに保存
                </MenuListItem>
              )}
              {ieMenu.selText && (
                <MenuListItem onClick={() => copyText(ieMenu.selText!, "選択文字")} style={{ fontSize: 11 }}>
                  選択文字をコピー
                </MenuListItem>
              )}
              {!ieMenu.linkUrl && currentUrl && (
                <MenuListItem onClick={() => copyText(currentUrl, "ページURL")} style={{ fontSize: 11 }}>
                  ページのURLをコピー
                </MenuListItem>
              )}
              {(ieMenu.linkUrl || ieMenu.imgUrl || ieMenu.selText || currentUrl) && <Separator />}
              <MenuListItem
                disabled={saving || (!currentUrl && !address.trim() && !ieMenu.linkUrl)}
                onClick={() => {
                  if (ieMenu.linkUrl) {
                    const u = ieMenu.linkUrl;
                    setIeMenu(null);
                    const name = fileNameForSave(u, null);
                    setSaving(true);
                    setStatusText(`Saving ${u} → Wenge...`);
                    fetch(`/api/proxy?url=${encodeURIComponent(u)}`)
                      .then(async (res) => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const blob = await res.blob();
                        await saveUrlToVfs(u, getVfsDirByExt(name), { filename: name, mime: blob.type || "text/html" });
                        setStatusText(`Document done: ${u}`);
                      })
                      .catch((e: unknown) => {
                        const msg = e instanceof Error ? e.message : String(e);
                        setError(`保存に失敗しました: ${msg}`);
                      })
                      .finally(() => setSaving(false));
                  } else {
                    setIeMenu(null);
                    void handleSave();
                  }
                }}
                style={{ fontSize: 11 }}
              >
                ページをWengeに保存
              </MenuListItem>
              <Separator />
              <div style={{ fontSize: 10, color: "#808080", padding: "2px 8px", lineHeight: 1.4 }}>
                ✓ 互換表示(プロキシ経由)
              </div>
            </MenuList>
          </div>
        </>
      )}
    </div>
  );
}
