import { useCallback, useEffect, useRef, useState } from "react";
import { Button, TextInput, ProgressBar, Anchor, Frame, MenuList, MenuListItem, Separator } from "react95";
import { showError } from "../components/SystemDialog";
import { CloseGlyph } from "../components/CaptionGlyphs";
import { getVfsDirByExt } from "../lib/downloadTarget";
import { saveUrlToVfs } from "../lib/vfs/download";
import type { VfsFile } from "../lib/vfs/types";
import { consumePendingVfsFile } from "../lib/vfs/openWith";
import { getViewMetrics, toVirtualPoint } from "../lib/display";

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

type IeTab = {
  id: string;
  title: string;
  address: string;
  currentUrl: string;
  historyStack: string[];
  hIndex: number;
  vfsHtml: string | null;
  vfsName: string | null;
  statusText: string;
  error: string | null;
  ddgBlocked: BlockInfo | null;
  loading: boolean;
  reloadKey: number;
};

let ieTabSeq = 1;
function createBlankTab(): IeTab {
  return {
    id: `tab-${Date.now()}-${ieTabSeq++}`,
    title: "空白ページ",
    address: "",
    currentUrl: "",
    historyStack: [],
    hIndex: -1,
    vfsHtml: null,
    vfsName: null,
    statusText: "準備完了 - URLまたは検索ワードを入力してください",
    error: null,
    ddgBlocked: null,
    loading: false,
    reloadKey: 0,
  };
}

function deriveTabTitle(t: Pick<IeTab, "currentUrl" | "address" | "vfsName">): string {
  if (t.vfsName) return t.vfsName.length > 18 ? t.vfsName.slice(0, 17) + "…" : t.vfsName;
  const src = t.currentUrl || t.address.trim();
  if (!src) return "空白ページ";
  try {
    const s = isProbablyUrl(src) ? normalizeUrl(src) : null;
    if (s) {
      const u = new URL(s);
      const host = u.hostname.replace(/^www\./, "");
      return host.length > 20 ? host.slice(0, 19) + "…" : host;
    }
  } catch {}
  const short = src.trim();
  return short.length > 18 ? short.slice(0, 17) + "…" : short;
}

function iframeSrcFor(tab: Pick<IeTab, "vfsHtml" | "currentUrl">): string {
  if (tab.vfsHtml) return "about:blank";
  return tab.currentUrl ? `/api/proxy?url=${encodeURIComponent(tab.currentUrl)}` : "about:blank";
}

export function InternetExplorerApp({ file }: { file?: VfsFile | null }) {
  const [tabs, setTabs] = useState<IeTab[]>(() => [createBlankTab()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // 全サイトをプロキシ経由で表示する (直接表示は廃止: 右クリック横取り・XFO/CSP回避のため)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeTab: IeTab = tabs.find((t) => t.id === (activeId ?? tabs[0]?.id)) ?? tabs[0];
  const activeTabId = activeTab?.id ?? null;

  const updateTab = useCallback((id: string, patch: Partial<IeTab> | ((prev: IeTab) => Partial<IeTab>)) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }, []);

  // Wenge内右クリックメニュー (Win95風)。iframe内のcontextmenuを横取りして表示する。
  type IeMenuState = { x: number; y: number; linkUrl?: string | null; imgUrl?: string | null; selText?: string | null };
  const [ieMenu, setIeMenu] = useState<IeMenuState | null>(null);
  const ieRootRef = useRef<HTMLDivElement>(null);
  const ctxCleanupMap = useRef(new Map<string, () => void>());
  const linkCleanupMap = useRef(new Map<string, () => void>());

  const iframeEls = useRef(new Map<string, HTMLIFrameElement | null>());
  const setIframeEl = useCallback((id: string) => (el: HTMLIFrameElement | null) => {
    if (el) iframeEls.current.set(id, el);
    else iframeEls.current.delete(id);
  }, []);

  const lastFileKeyRef = useRef<string | null>(null);

  // Check proxy response for DDG bot block before committing iframe
  // ---- tabs ----
  const activeTabIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);
  const navigateToRef = useRef<(raw: string, tabId?: string) => void>(() => {});
  const addTabRef = useRef<(initialUrl?: string) => string>(() => "");

  // postMessageで届いたURLをWenge IE内の遷移先として解決する。
  // 子iframeは解決済み絶対URL(元サイトURL)を送る想定だが、念のため
  // /api/proxy?url=... 形式が来たら内側URLを取り出す。
  function unwrapProxyUrl(raw: string): string {
    const s = raw.trim();
    try {
      const m = s.match(/\/api\/proxy\?url=([^&]+)/);
      if (m?.[1]) {
        try { return decodeURIComponent(m[1]); } catch { return m[1]; }
      }
      const u = new URL(s, window.location.origin);
      if (u.pathname === "/api/proxy" && u.searchParams.get("url")) {
        return u.searchParams.get("url")!;
      }
    } catch {}
    return s;
  }

  function isVfsFileUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return /\.(mp3|wav|ogg|m4a|flac|mp4|webm|zip|rar|7z|pdf|png|jpg|jpeg|gif|bmp|webp|svg|txt|doc|docx|xls|xlsx)(\?|#|$)/i.test(u.pathname + u.search);
    } catch {
      return /\.(mp3|wav|ogg|m4a|flac|mp4|webm|zip|rar|7z|pdf|png|jpg|jpeg|gif|bmp|webp|svg|txt|doc|docx|xls|xlsx)(\?|#|$)/i.test(url);
    }
  }

  const closeTab = useCallback((id: string) => {
    try { ctxCleanupMap.current.get(id)?.(); } catch {}
    ctxCleanupMap.current.delete(id);
    try { linkCleanupMap.current.get(id)?.(); } catch {}
    linkCleanupMap.current.delete(id);
    iframeEls.current.delete(id);
    setIeMenu(null);
    setTabs((prev) => {
      if (prev.length <= 1) {
        // 最後の1つは空白化して残す
        return prev.map((t) => (t.id === id ? { ...createBlankTab(), id: t.id } : t));
      }
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (id === activeTabIdRef.current) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        setActiveId(fallback.id);
      }
      return next;
    });
  }, []);

  const addTab = useCallback((initialUrl?: string) => {
    const t = createBlankTab();
    setTabs((prev) => [...prev, t]);
    setActiveId(t.id);
    activeTabIdRef.current = t.id;
    setFallbackNotice(null);
    if (initialUrl) {
      setTimeout(() => navigateToRef.current(initialUrl, t.id), 0);
    }
    return t.id;
  }, []);

  // file prop / 共有pendingは「新規タブで開く」。既存タブは潰さない。
  useEffect(() => {
    const pending = file ?? consumePendingVfsFile();
    if (!pending?.blob) return;
    const key = `${pending.name}:${pending.blob.size}:${("lastModified" in pending.blob && (pending.blob as File).lastModified) || 0}`;
    if (lastFileKeyRef.current === key) return;
    lastFileKeyRef.current = key;
    pending.blob.text().then((text) => {
      const title = pending.name.length > 18 ? pending.name.slice(0, 17) + "…" : pending.name;
      let reuseId: string | null = null;
      setTabs((prev) => {
        const first = prev[0];
        if (prev.length === 1 && first && !first.currentUrl && !first.vfsHtml && !first.address) {
          reuseId = first.id;
          return [{
            ...first, vfsHtml: text, vfsName: pending.name, address: pending.name,
            title, statusText: `VFS: ${pending.name}`, currentUrl: "", error: null,
          }];
        }
        const t = createBlankTab();
        t.vfsHtml = text;
        t.vfsName = pending.name;
        t.address = pending.name;
        t.title = title;
        t.statusText = `VFS: ${pending.name}`;
        reuseId = t.id;
        return [...prev, t];
      });
      setTimeout(() => { if (reuseId) { setActiveId(reuseId); activeTabIdRef.current = reuseId; } }, 0);
    }).catch(() => {
      const id = activeTabIdRef.current;
      if (id) updateTab(id, { error: "HTMLファイルの読み込みに失敗しました。" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

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
    (raw: string, tabId?: string, opts?: { replaceHistory?: boolean; forceProxy?: boolean }) => {
      void opts;
      const id = tabId ?? activeTabIdRef.current;
      if (!id) return;
      const trimmed = raw.trim();
      if (!trimmed) {
        updateTab(id, { error: "URLまたは検索ワードを入力してください。", statusText: "Navigation canceled" });
        return;
      }

      let targetUrl: string;
      let searchQuery: string | null = null;
      if (isProbablyUrl(trimmed)) {
        const normalized = normalizeUrl(trimmed);
        if (!normalized) {
          updateTab(id, { error: "無効なURLです。http:// または https:// で始まるURLを入力してください。", statusText: "Navigation canceled" });
          return;
        }
        targetUrl = normalized;
      } else {
        searchQuery = trimmed;
        // Bingをデフォルト検索に: Vercel IPでDDG htmlは恒久202ブロックのため
        targetUrl = toBingUrl(trimmed);
      }

      const title = deriveTabTitle({ currentUrl: targetUrl, address: targetUrl, vfsName: null });
      setTabs((prev) => prev.map((t) => {
        if (t.id !== id) return t;
        let historyStack = t.historyStack;
        let hIndex = t.hIndex;
        if (!opts?.replaceHistory) {
          const truncated = t.historyStack.slice(0, t.hIndex + 1);
          if (truncated[truncated.length - 1] !== targetUrl) {
            historyStack = [...truncated, targetUrl];
            hIndex = historyStack.length - 1;
          }
        } else {
          const next = [...t.historyStack];
          next[t.hIndex] = targetUrl;
          historyStack = next;
        }
        const sameUrl = targetUrl === t.currentUrl;
        return {
          ...t, error: null, ddgBlocked: null, vfsHtml: null, vfsName: null,
          statusText: searchQuery ? `Bingで検索(プロキシ経由): ${searchQuery}` : `互換表示(プロキシ経由)で開いています: ${targetUrl}`,
          loading: true, historyStack, hIndex,
          currentUrl: targetUrl, address: targetUrl, title,
          reloadKey: sameUrl ? t.reloadKey + 1 : t.reloadKey,
        };
      }));
      setFallbackNotice(null);
    },
    [updateTab],
  );

  useEffect(() => {
    navigateToRef.current = (raw: string, tabId?: string) => navigateTo(raw, tabId);
  }, [navigateTo]);

  useEffect(() => {
    addTabRef.current = (initialUrl?: string) => addTab(initialUrl);
  }, [addTab]);

  // iframe内注入スクリプトからの遷移要求を受け、Wenge IE内で開く。
  // _blank / window.open → 新規IEタブ、それ以外(通常左クリック/_self) → 同じタブで遷移。
  // 実機ブラウザには一切飛ばさない。
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      try {
        if (e.origin !== window.location.origin) return;
      } catch { return; }
      const d = e.data as { type?: string; url?: string; target?: string; kind?: string } | null;
      if (!d || d.type !== "wenge-ie-navigate" || typeof d.url !== "string") return;
      let srcTabId: string | null = null;
      iframeEls.current.forEach((el, id) => {
        if (el?.contentWindow === e.source) srcTabId = id;
      });
      const fromId = srcTabId ?? activeTabIdRef.current;
      if (!fromId) return;
      const inner = unwrapProxyUrl(d.url);
      if (/^(javascript|data|blob|mailto|tel):/i.test(inner)) return;
      const normalized = normalizeUrl(inner);
      if (!normalized) return;
      if (isVfsFileUrl(normalized)) {
        try {
          const name = fileNameForSave(normalized, null);
          const dir = getVfsDirByExt(name);
          void saveUrlToVfs(normalized, dir, { filename: name }).catch(() => {
            showError("Download", "VFS保存に失敗しました。");
          });
        } catch {
          showError("Download", "リンクの保存に失敗しました。");
        }
        return;
      }
      if (d.target === "_blank") {
        addTabRef.current(normalized);
      } else {
        navigateToRef.current(normalized, fromId);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const goBack = (tabId?: string) => {
    const id = tabId ?? activeTabIdRef.current;
    if (!id) return;
    const tab = tabs.find((t) => t.id === id);
    if (!tab || tab.hIndex <= 0) return;
    const nextIdx = tab.hIndex - 1;
    const url = tab.historyStack[nextIdx];
    updateTab(id, {
      hIndex: nextIdx, error: null, ddgBlocked: null, vfsHtml: null, vfsName: null,
      statusText: `Opening ${url}...`, loading: true, currentUrl: url, address: url,
      title: deriveTabTitle({ currentUrl: url, address: url, vfsName: null }),
    });
    setFallbackNotice(null);
  };

  const goForward = (tabId?: string) => {
    const id = tabId ?? activeTabIdRef.current;
    if (!id) return;
    const tab = tabs.find((t) => t.id === id);
    if (!tab || tab.hIndex >= tab.historyStack.length - 1) return;
    const nextIdx = tab.hIndex + 1;
    const url = tab.historyStack[nextIdx];
    updateTab(id, {
      hIndex: nextIdx, error: null, ddgBlocked: null, vfsHtml: null, vfsName: null,
      statusText: `Opening ${url}...`, loading: true, currentUrl: url, address: url,
      title: deriveTabTitle({ currentUrl: url, address: url, vfsName: null }),
    });
    setFallbackNotice(null);
  };

  const handleRefresh = (tabId?: string) => {
    const id = tabId ?? activeTabIdRef.current;
    if (!id) return;
    const tab = tabs.find((t) => t.id === id);
    if (!tab || !tab.currentUrl) return;
    updateTab(id, (t) => ({
      error: null, ddgBlocked: null, loading: true,
      statusText: `Refreshing ${t.currentUrl}...`, reloadKey: t.reloadKey + 1,
    }));
    setFallbackNotice(null);
  };

  const handleStop = (tabId?: string) => {
    const id = tabId ?? activeTabIdRef.current;
    if (!id) return;
    updateTab(id, { loading: false, statusText: "Navigation stopped" });
    const iframe = iframeEls.current.get(id);
    if (iframe) {
      try {
        iframe.src = "about:blank";
        setTimeout(() => {
          const el = iframeEls.current.get(id);
          const cur = tabs.find((t) => t.id === id);
          if (el && cur?.currentUrl) el.src = iframeSrcFor(cur);
        }, 0);
      } catch {}
    }
  };

  const handleGo = () => { if (activeTab) navigateTo(activeTab.address, activeTab.id); };
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && activeTab) navigateTo(activeTab.address, activeTab.id);
  };

  // Save the active tab page to Wenge VFS via /api/proxy
  const handleSave = async () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    const target = tab?.currentUrl || tab?.address.trim() || "";
    if (!target || !tab) {
      if (activeTabId) updateTab(activeTabId, { error: "保存するページを開いてください。" });
      return;
    }
    const pageUrl = isProbablyUrl(target) ? normalizeUrl(target) : null;
    if (!pageUrl) {
      updateTab(tab.id, { error: "保存できるURLではありません。ファイルのURLを開いてから保存してください。" });
      return;
    }
    setSaving(true);
    updateTab(tab.id, { statusText: `Saving ${pageUrl} → Wenge...` });
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(pageUrl)}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let msg = `保存に失敗しました (HTTP ${res.status})`;
        try {
          const j = JSON.parse(body);
          if (j?.error) msg = `保存に失敗しました: ${j.error}`;
        } catch {}
        updateTab(tab.id, { error: msg, statusText: "Save failed" });
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        updateTab(tab.id, { error: "このページは保存できません（プロキシがブロックを検出）。", statusText: "Save failed" });
        return;
      }
      const blob = await res.blob();
      const name = fileNameForSave(pageUrl, res.headers.get("content-disposition"));
      const dir = getVfsDirByExt(name);
      updateTab(tab.id, { statusText: `Document done: ${pageUrl}`, error: null });
      await saveUrlToVfs(pageUrl, dir, { filename: name, mime: blob.type || "text/html" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateTab(tab.id, { error: `保存に失敗しました: ${msg}`, statusText: "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const injectCursorStyles = (tabId: string) => {
    const iframe = iframeEls.current.get(tabId);
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

  const handleIframeLoad = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    const iframe = iframeEls.current.get(tabId);
    updateTab(tabId, { loading: false });
    // Detect JSON bot-block rendered inside iframe (fallback for race)
    try {
      const doc = iframe?.contentDocument;
      if (doc) {
        const txt = doc.body?.innerText || "";
        if (txt.includes("bot blocked") || (txt.includes("If this persists") && txt.includes("anonymized"))) {
          const q = tab?.ddgBlocked?.query || tab?.address || "";
          if (q && !isProbablyUrl(q)) {
            updateTab(tabId, { ddgBlocked: { query: q, code: "anonymized", email: null, originalUrl: tab?.currentUrl || "" } });
            const bingUrl = toBingUrl(q);
            setFallbackNotice("DDGブロックを検出 → Bingで代替表示します（Win95窓内）。");
            navigateTo(bingUrl, tabId);
            return;
          }
        }
      }
    } catch {}
    if (tab?.currentUrl) updateTab(tabId, { statusText: `互換表示(プロキシ経由): ${tab.currentUrl}`, error: null });

    // Attach link interceptor (fallback for injected script) + VFS downloads
    const cleanupClick = attachIeLinkInterceptor(tabId);
    if (cleanupClick) {
      try { linkCleanupMap.current.get(tabId)?.(); } catch {}
      linkCleanupMap.current.set(tabId, cleanupClick);
    }
    attachIeContextMenu(tabId);
    injectCursorStyles(tabId);
  };

  const handleIframeError = (tabId: string) => {
    updateTab(tabId, { loading: false, error: "ページの読み込みに失敗しました。別の検索で試してください。", statusText: "Error loading document" });
  };

  /**
   * iframe内の全リンククリック/フォーム送信を横取りする(親側フォールバック)。
   * プロキシ注入スクリプトがCSP等で動かない場合・srcdoc表示の場合の二重網。
   * - ファイル系URL → VFS保存(遷移しない)
   * - target=_blank / Ctrl+クリック / 中クリック / window.open相当 → Wenge内新規IEタブ
   * - 通常左クリック(_self/無指定) → 同じタブでプロキシ遷移
   * いずれもpreventDefaultで実機ブラウザへの飛び出しを阻止する。
   */
  const attachIeLinkInterceptor = useCallback((tabId: string) => {
    const iframe = iframeEls.current.get(tabId);
    if (!iframe) return;
    const baseUrl = tabs.find((t) => t.id === tabId)?.currentUrl || "";
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      return;
    }
    if (!doc) return;
    const resolveAbs = (href: string): string | null => {
      try {
        return new URL(href, iframe.contentWindow?.location.href || doc.baseURI || baseUrl).toString();
      } catch { return null; }
    };
    const routeUrl = (absolute: string, target: string) => {
      const inner = unwrapProxyUrl(absolute);
      if (/^(javascript|data|blob|mailto|tel):/i.test(inner)) return;
      if (isVfsFileUrl(inner)) {
        try {
          const name = fileNameForSave(inner, null);
          const dir = getVfsDirByExt(name);
          void saveUrlToVfs(inner, dir, { filename: name }).catch(() => {
            showError("Download", "VFS保存に失敗しました。");
          });
        } catch {
          showError("Download", "リンクの保存に失敗しました。");
        }
        return;
      }
      const normalized = normalizeUrl(inner);
      if (!normalized) return;
      if (target === "_blank") {
        addTabRef.current(normalized);
      } else {
        navigateToRef.current(normalized, tabId);
      }
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || /^javascript:/i.test(href) || /^data:/i.test(href)) return;
      if (href.startsWith("#")) return;
      const absolute = resolveAbs(href);
      if (!absolute || !/^https?:/i.test(absolute)) return;
      // 実機への飛び出しを阻止
      e.preventDefault();
      e.stopPropagation();
      const t = (anchor.getAttribute("target") || "").toLowerCase();
      const isNew = t === "_blank" || e.ctrlKey || e.metaKey;
      routeUrl(absolute, isNew ? "_blank" : "_self");
    };
    const onAuxClick = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const anchor = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      const absolute = resolveAbs(href);
      if (!absolute || !/^https?:/i.test(absolute)) return;
      e.preventDefault();
      e.stopPropagation();
      routeUrl(absolute, "_blank");
    };
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement | null;
      if (!f || f.tagName !== "FORM") return;
      // GETフォームのみ横取り。POST等はGET偽装せず素通し(ネイティブ送信に任せる)。
      let method = "GET";
      try { method = (f.method || f.getAttribute("method") || "GET").toUpperCase(); } catch { method = "GET"; }
      if (method !== "GET" && method !== "") return;
      const rawAction = f.getAttribute("action");
      const base = resolveAbs(rawAction ? rawAction : (doc.baseURI || baseUrl));
      if (!base || !/^https?:/i.test(base)) return;
      e.preventDefault();
      e.stopPropagation();
      // 入力値をクエリにシリアライズ(actionの既存クエリは保持)。File値は除外。
      let url = base;
      try {
        const u = new URL(base);
        const fd = new FormData(f);
        fd.forEach((v, k) => { if (typeof v === "string") u.searchParams.append(k, v); });
        const sub = (e as SubmitEvent).submitter as unknown as { name?: string; value?: string; type?: string } | null;
        if (sub?.name && sub.type !== "image" && sub.value !== undefined) {
          u.searchParams.append(sub.name, sub.value);
        }
        url = u.toString();
      } catch { url = base; }
      const t = (f.getAttribute("target") || "").toLowerCase();
      routeUrl(url, t === "_blank" ? "_blank" : "_self");
    };
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("auxclick", onAuxClick, true);
    doc.addEventListener("submit", onSubmit, true);
    // cleanup on next navigation
    const cleanup = () => {
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("auxclick", onAuxClick, true);
      doc.removeEventListener("submit", onSubmit, true);
    };
    return cleanup;
  }, [tabs]);

  /** iframe内の右クリックを横取りしてWenge内メニューを出す(プロキシ/srcdocは同一オリジンのため介入可) */
  const attachIeContextMenu = useCallback((tabId: string) => {
    const iframe = iframeEls.current.get(tabId);
    if (!iframe) return;
    const tab = tabs.find((t) => t.id === tabId);
    const baseUrl = tab?.currentUrl || "";
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      // プロキシ経由は同一オリジンのため通常ここには来ない
      return;
    }
    if (!doc) return;
    // 既存の抑止があれば張り替え
    const prevCleanup = ctxCleanupMap.current.get(tabId);
    if (prevCleanup) {
      try { prevCleanup(); } catch {}
      ctxCleanupMap.current.delete(tabId);
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
              linkUrl = new URL(href, iframe.contentWindow?.location.href || baseUrl).toString();
            } catch { linkUrl = href; }
          }
        }
        if (img) {
          const src = img.getAttribute("src") || img.currentSrc;
          if (src && !src.startsWith("data:")) {
            try {
              imgUrl = new URL(src, iframe.contentWindow?.location.href || baseUrl).toString();
            } catch { imgUrl = src; }
          }
        }
        let selText: string | null = null;
        try {
          const sel = doc!.getSelection?.()?.toString() || iframe.contentWindow?.getSelection?.()?.toString();
          if (sel && sel.trim()) selText = sel.slice(0, 200);
        } catch {}
        // iframe内のclientX/Yはiframeビューポート基準なので、外側ウィンドウ基準に
        // 直してから仮想化する (直さないとツールバー+窓位置ぶん左上にずれる)。
        // 仮想画面の論理pxに換算して保持する (仮想画面基準のfixed配置のため)
        const frameRect = iframe.getBoundingClientRect();
        const v = toVirtualPoint(frameRect.left + e.clientX, frameRect.top + e.clientY);
        setIeMenu({ x: v.x, y: v.y, linkUrl, imgUrl, selText });
      } catch {
        const frameRect = iframe.getBoundingClientRect();
        const v = toVirtualPoint(frameRect.left + e.clientX, frameRect.top + e.clientY);
        setIeMenu({ x: v.x, y: v.y });
      }
    };
    doc.addEventListener("contextmenu", onCtx, true);
    ctxCleanupMap.current.set(tabId, () => {
      doc.removeEventListener("contextmenu", onCtx, true);
    });
  }, [tabs]);

  // ナビゲーション時にそのタブのinterceptorを張り替え + メニューを閉じる
  const navSig = tabs.map((t) => `${t.id}:${t.currentUrl}:${t.vfsHtml ? t.vfsHtml.length : 0}:${t.reloadKey}`).join("|");
  useEffect(() => {
    setIeMenu(null);
    // Attach new one will happen in handleIframeLoad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navSig]);

  // Cleanup on unmount
  useEffect(() => {
    const ctxMap = ctxCleanupMap.current;
    const linkMap = linkCleanupMap.current;
    return () => {
      linkMap.forEach((fn) => { try { fn(); } catch {} });
      linkMap.clear();
      ctxMap.forEach((fn) => { try { fn(); } catch {} });
      ctxMap.clear();
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
    setIeMenu(null);
    const id = activeTabIdRef.current;
    try {
      await navigator.clipboard.writeText(text);
      if (id) updateTab(id, { statusText: `${label}をコピーしました` });
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        if (id) updateTab(id, { statusText: `${label}をコピーしました` });
      } catch {
        showError("Copy", "コピーに失敗しました。");
      }
    }
  };

  // IE枠(ツールバー外・iframe外)の右クリックでもWengeメニューを出す
  const handleIeRootContextMenu = (e: React.MouseEvent) => {
    // iframe内はiframe側リスナーが処理する。ここはiframe外の余白用。
    // iframe上では親にバブリングしないため二重表示にはならない。
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-ie-iframe-layer]")) return;
    e.preventDefault();
    const v = toVirtualPoint(e.clientX, e.clientY);
    setIeMenu({ x: v.x, y: v.y });
  };

  // Fix cursor reset when IE is active - prevent global cursor from overriding
  useEffect(() => {
    tabs.forEach((t) => {
      if (!t.currentUrl) return;
      const iframe = iframeEls.current.get(t.id);
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument;
        if (doc && !doc.getElementById("w95-iframe-cursors")) {
          injectCursorStyles(t.id);
        }
      } catch {}
    });
  }, [navSig]);

  // w95カーソルのちらつき防止: iframe内外の出入りのたびに安全な既定に戻す
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest?.("[data-ie-iframe-layer]")) return;
      const anyLoading = tabs.some((x) => x.loading);
      if (!anyLoading && ieRootRef.current) ieRootRef.current.style.cursor = "";
    };
    window.addEventListener("mousemove", onMouseMove, true);
    return () => window.removeEventListener("mousemove", onMouseMove, true);
  }, [tabs]);

  useEffect(() => {
    const onLeave = () => { if (ieRootRef.current) ieRootRef.current.style.cursor = ""; };
    const root = ieRootRef.current;
    root?.addEventListener("mouseleave", onLeave);
    return () => { root?.removeEventListener("mouseleave", onLeave); };
  }, []);

  const canBack = (activeTab?.hIndex ?? -1) > 0;
  const canForward = activeTab ? activeTab.hIndex < activeTab.historyStack.length - 1 : false;

  const handleFallbackBing = () => {
    if (!activeTab?.ddgBlocked) return;
    const bingUrl = toBingUrl(activeTab.ddgBlocked.query);
    setFallbackNotice(`Bingで再検索: ${activeTab.ddgBlocked.query}`);
    navigateTo(bingUrl, activeTab.id);
  };
  const handleFallbackWiki = () => {
    if (!activeTab?.ddgBlocked) return;
    const wikiUrl = toWikipediaUrl(activeTab.ddgBlocked.query);
    setFallbackNotice(`Wikipediaで検索: ${activeTab.ddgBlocked.query}`);
    navigateTo(wikiUrl, activeTab.id);
  };
  const handleRetryDdg = async () => {
    const tab = activeTab;
    const q = tab?.ddgBlocked?.query || tab?.address.trim() || "";
    if (!tab || !q || isProbablyUrl(q)) return;
    // DDGを明示的に試す（失敗時はproxyが502を返し、checkで検出してBingに留まる）
    const ddgUrl = toDuckDuckGoUrl(q);
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(ddgUrl)}`;
    setFallbackNotice(`DDGを再試行中: ${q}...`);
    const check = await checkDdgBlocked(proxyUrl);
    if (check.blocked) {
      updateTab(tab.id, { ddgBlocked: { query: q, code: check.code, email: check.email, originalUrl: ddgUrl } });
      setFallbackNotice(`DDGは依然ブロック中 (code: ${check.code || "anonymized"})。Bingで継続します。`);
      return;
    }
    updateTab(tab.id, { ddgBlocked: null });
    setFallbackNotice(`DDGで表示: ${q}`);
    navigateTo(ddgUrl, tab.id);
  };

  const anyLoading = tabs.some((t) => t.loading);

  // ---- tab shortcuts: Ctrl+T / Ctrl+W / Ctrl+Tab ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "t") { e.preventDefault(); e.stopPropagation(); addTab(); }
      else if (k === "w") { e.preventDefault(); e.stopPropagation(); if (activeTabIdRef.current) closeTab(activeTabIdRef.current); }
      else if (e.key === "Tab") {
        e.preventDefault(); e.stopPropagation();
        const dir = e.shiftKey ? -1 : 1;
        setTabs((prev) => {
          if (prev.length <= 1) return prev;
          const idx = prev.findIndex((t) => t.id === activeTabIdRef.current);
          const next = prev[(idx + dir + prev.length) % prev.length];
          if (next) { setActiveId(next.id); activeTabIdRef.current = next.id; }
          return prev;
        });
        setIeMenu(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [addTab, closeTab]);

  // VFS HTML (srcdoc) 表示: 完全保持のため各iframeに個別設定
  useEffect(() => {
    tabs.forEach((t) => {
      if (!t.vfsHtml) return;
      const iframe = iframeEls.current.get(t.id);
      if (iframe && iframe.srcdoc !== t.vfsHtml) iframe.srcdoc = t.vfsHtml;
    });
  }, [tabs]);

  const activeError: string | null = activeTab?.error ?? null;
  const activeDdg = activeTab?.ddgBlocked ?? null;

  const selectTab = (id: string) => {
    setActiveId(id);
    activeTabIdRef.current = id;
    setIeMenu(null);
    setFallbackNotice(null);
  };

  return (
    <div ref={ieRootRef} onContextMenu={handleIeRootContextMenu} className={anyLoading ? "w95-ie-loading" : undefined} style={{ display: "flex", flexDirection: "column", gap: 4, height: "100%", minHeight: 0, flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, overflowX: "auto", padding: "2px 2px 0", background: "#008080" }}>
        {tabs.map((t) => {
          const isActive = t.id === activeTabId;
          return (
            <div
              key={t.id}
              onClick={() => selectTab(t.id)}
              title={t.vfsName || t.currentUrl || "空白ページ"}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                maxWidth: 160, minWidth: 60, padding: "3px 4px 3px 6px",
                fontSize: 11, whiteSpace: "nowrap",
                background: isActive ? "#c0c0c0" : "#808080",
                color: isActive ? "#000" : "#fff",
                borderTop: "2px outset #fff", borderLeft: "2px outset #fff", borderRight: "2px outset #fff",
                borderBottom: isActive ? "none" : "2px solid #c0c0c0",
                cursor: "url('/cursors/hand.png') 12 0, pointer", userSelect: "none",
              }}
            >
              {t.loading && <span style={{ fontSize: 10 }}>⏳</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{t.title}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                title="タブを閉じる (Ctrl+W)"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 14, height: 12, padding: 0,
                  background: "#c0c0c0",
                  borderTop: "1px solid #fff", borderLeft: "1px solid #fff",
                  borderRight: "1px solid #808080", borderBottom: "1px solid #808080",
                  boxShadow: "inset -1px -1px 0 #404040, inset 1px 1px 0 #dfdfdf",
                  imageRendering: "pixelated",
                }}
              ><CloseGlyph size={8} /></span>
            </div>
          );
        })}
        <Button size="sm" onClick={() => addTab()} title="新しいタブ (Ctrl+T)" style={{ flexShrink: 0, marginBottom: 1 }}>+</Button>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <Button size="sm" disabled={!canBack} onClick={() => goBack()}>◀ Back</Button>
        <Button size="sm" disabled={!canForward} onClick={() => goForward()}>▶ Forward</Button>
        <Button size="sm" onClick={() => handleRefresh()} disabled={!activeTab?.currentUrl}>Refresh</Button>
        <Button size="sm" onClick={() => handleStop()} disabled={!activeTab?.loading}>Stop</Button>
        <TextInput value={activeTab?.address ?? ""} onChange={(e) => { if (activeTabId) updateTab(activeTabId, { address: e.target.value }); }} onKeyDown={handleAddressKeyDown} placeholder="URL または検索ワード (例: wenge / example.com)" style={{ flex: 1, minWidth: 160 }} />
        <Button onClick={handleGo} disabled={activeTab?.loading} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }}>Go</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || (!activeTab?.currentUrl && !activeTab?.address.trim())} title="このページをWenge内に保存">Wenge保存</Button>
      </div>

      {anyLoading && activeTab?.loading && <ProgressBar value={60} style={{ height: 12 }} />}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
        <span style={{ fontWeight: "bold" }}>お気に入り:</span>
        {QUICK_LINKS.map((u) => (
          <Anchor key={u} onClick={() => { if (activeTabId) navigateTo(u, activeTabId); }} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer", fontSize: 11 }}>{u.replace("https://", "")}</Anchor>
        ))}
        <Anchor onClick={() => { if (activeTabId) navigateTo("https://www.wenge.co.jp/", activeTabId); }} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer", fontSize: 11 }}>wenge.co.jp</Anchor>
      </div>

      {fallbackNotice && (
        <Frame variant="well" style={{ background: "#ffffe1", padding: "6px 8px", fontSize: 11, color: "#000080", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>ℹ {fallbackNotice}</span>
          <Button size="sm" onClick={() => setFallbackNotice(null)}>閉じる</Button>
        </Frame>
      )}

      {activeDdg && (
        <Frame variant="well" style={{ background: "#c0c0c0", padding: 8, display: "flex", flexDirection: "column", gap: 6, border: "2px inset #fff" }}>
          <div style={{ fontSize: 11, fontWeight: "bold", color: "#000080", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>⚠</span> DuckDuckGo が一時的にブロックされました
            {activeDdg.code && <span style={{ fontWeight: "normal", color: "#800000", fontSize: 10 }}>code: {activeDdg.code.slice(0, 40)}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#000", lineHeight: 1.4, background: "#fff", border: "2px inset #fff", padding: 6 }}>
            検索 <b>{activeDdg.query}</b> は DuckDuckGo 側のボット判定（<code>If this persists… anonymized</code>）でブロックされました。<br />
            VercelのデータセンターIP/TLSが原因で、ヘッダ偽装だけでは回避できない場合があります。<br />
            <b>Win95窓内で代替検索を表示しています。</b> 外部ブラウザには遷移しません。
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Button size="sm" onClick={handleRetryDdg}>DDGを再試行</Button>
            <Button size="sm" onClick={handleFallbackBing}>Bingで検索（窓内）</Button>
            <Button size="sm" onClick={handleFallbackWiki}>Wikipediaで検索（窓内）</Button>
            <Button size="sm" onClick={() => { if (activeTabId) updateTab(activeTabId, { ddgBlocked: null }); setFallbackNotice(null); }}>閉じる</Button>
          </div>
          <div style={{ fontSize: 10, color: "#808080" }}>現在は Bing 結果をプロキシ経由で表示中。アドレスバーのURLは窓内で切り替え可能です。</div>
        </Frame>
      )}

      {activeError && !activeDdg && (
        <Frame variant="well" style={{ background: "#ffffe1", padding: "6px 8px", fontSize: 11, color: "#800000", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>⚠ {activeError}</span>
        </Frame>
      )}

      <div style={{ flex: 1, minHeight: 0, background: "#fff", border: "none", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div data-ie-iframe-layer style={{ flex: 1, position: "relative", background: "#fff", overflow: "hidden" }}>
          {tabs.map((t) => {
            const isActive = t.id === activeTabId;
            const hasContent = !!(t.currentUrl || t.vfsHtml);
            if (!hasContent) {
              return isActive ? (
                <div key={t.id} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#008080", padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", textShadow: "1px 1px 0 #000" }}>Internet Explorer</div>
                  <div style={{ fontSize: 11, color: "#fff", textShadow: "1px 1px 0 #000", lineHeight: 1.5 }}>
                    Enter URL or search word and click <b>Go</b> or press <b>Enter</b> to open.<br />
                    Search words are displayed in Bing window.
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    <Button size="sm" onClick={() => navigateTo("https://www.bing.com/", t.id)} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }}>Bing Home</Button>
                    <Button size="sm" onClick={() => navigateTo("https://ja.wikipedia.org/", t.id)} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }}>Wikipedia</Button>
                    <Button size="sm" onClick={() => navigateTo("https://example.com", t.id)} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }}>example.com</Button>
                  </div>
                  <div style={{ fontSize: 10, color: "#c0c0c0", textShadow: "1px 1px 0 #000" }}>Tip: Enter example.com</div>
                </div>
              ) : null;
            }
            return (
              <div key={t.id} style={{ position: "absolute", inset: 0, display: isActive ? "flex" : "none", background: "#fff" }}>
                <iframe
                  key={`${t.id}::${t.reloadKey}::${t.hIndex}::proxy`}
                  ref={setIframeEl(t.id)}
                  src={iframeSrcFor(t)}
                  title={`Wenge IE ${t.title}`}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-downloads"
                  allow="fullscreen; autoplay; clipboard-read; clipboard-write"
                  style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                  onLoad={() => handleIframeLoad(t.id)}
                  onError={() => handleIframeError(t.id)}
                />
                {t.loading && isActive && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)", display: "grid", placeItems: "center", fontSize: 11, color: "#000080", gap: 6 }}>
                    <div>Loading {t.currentUrl}...</div>
                    {t.ddgBlocked && <div style={{ fontSize: 10, color: "#808080" }}>DDGブロック検出時はBingに自動切替します</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
                const vw = getViewMetrics().w || window.innerWidth;
                const right = ieMenu.x + 2;
                if (right + w <= vw) return Math.max(4, right);
                return Math.max(4, ieMenu.x - w);
              })(),
              top: (() => {
                const h = 330;
                const vh = getViewMetrics().h || window.innerHeight;
                const below = ieMenu.y + 2;
                if (below + h <= vh) return Math.max(4, below);
                return Math.max(4, vh - h);
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
                disabled={!activeTab?.currentUrl && !activeTab?.vfsHtml}
                onClick={() => { setIeMenu(null); handleRefresh(); }}
                style={{ fontSize: 11 }}
              >
                ↻ 再読込
              </MenuListItem>
              <Separator />
              {ieMenu.linkUrl && (
                <MenuListItem
                  onClick={() => { const u = ieMenu.linkUrl!; setIeMenu(null); addTab(u); }}
                  style={{ fontSize: 11 }}
                >
                  新しいタブで開く (Wenge IE)
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
              {!ieMenu.linkUrl && activeTab?.currentUrl && (
                <MenuListItem onClick={() => copyText(activeTab.currentUrl, "ページURL")} style={{ fontSize: 11 }}>
                  ページのURLをコピー
                </MenuListItem>
              )}
              {(ieMenu.linkUrl || ieMenu.imgUrl || ieMenu.selText || activeTab?.currentUrl) && <Separator />}
              <MenuListItem
                disabled={saving || (!activeTab?.currentUrl && !activeTab?.address.trim() && !ieMenu.linkUrl)}
                onClick={() => {
                  if (ieMenu.linkUrl) {
                    const u = ieMenu.linkUrl;
                    setIeMenu(null);
                    const name = fileNameForSave(u, null);
                    setSaving(true);
                    if (activeTabId) updateTab(activeTabId, { statusText: `Saving ${u} → Wenge...` });
                    fetch(`/api/proxy?url=${encodeURIComponent(u)}`)
                      .then(async (res) => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const blob = await res.blob();
                        await saveUrlToVfs(u, getVfsDirByExt(name), { filename: name, mime: blob.type || "text/html" });
                        if (activeTabId) updateTab(activeTabId, { statusText: `Document done: ${u}` });
                      })
                      .catch((e: unknown) => {
                        const msg = e instanceof Error ? e.message : String(e);
                        if (activeTabId) updateTab(activeTabId, { error: `保存に失敗しました: ${msg}` });
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
