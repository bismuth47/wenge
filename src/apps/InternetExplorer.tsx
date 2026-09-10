import { useCallback, useEffect, useRef, useState } from "react";
import { Button, TextInput, ProgressBar, Anchor, Checkbox, Frame } from "react95";

const DEFAULT_URL = "https://example.com";
const QUICK_LINKS = [
  "https://example.com",
  "https://www.wikipedia.org",
  "https://neverssl.com",
  "https://info.cern.ch",
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

export function InternetExplorerApp() {
  const [address, setAddress] = useState(DEFAULT_URL);
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL);
  const [historyStack, setHistoryStack] = useState<string[]>([DEFAULT_URL]);
  const [hIndex, setHIndex] = useState(0);
  const hIndexRef = useRef(0);
  const [useProxy, setUseProxy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Document done");
  const [probeInfo, setProbeInfo] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const probeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    hIndexRef.current = hIndex;
  }, [hIndex]);

  const iframeSrc = currentUrl
    ? useProxy
      ? `/api/proxy?url=${encodeURIComponent(currentUrl)}`
      : currentUrl
    : "about:blank";

  const doProbe = useCallback(async (targetUrl: string) => {
    // cancel previous probe
    probeAbortRef.current?.abort();
    const ac = new AbortController();
    probeAbortRef.current = ac;
    try {
      setProbeInfo(null);
      const res = await fetch(`/api/proxy?probe=1&url=${encodeURIComponent(targetUrl)}`, {
        signal: ac.signal,
      });
      if (!res.ok) {
        // probe endpoint may not exist in dev (Vite without vercel dev) -> treat as not blocked
        return false;
      }
      const data = await res.json().catch(() => null);
      if (!data) return false;
      if (data.blocked) {
        const reason = data.xFrameOptions ? `X-Frame-Options: ${data.xFrameOptions}` : data.csp ? `CSP: ${String(data.csp).slice(0, 80)}` : "frame-ancestors restricted";
        setProbeInfo(reason);
        return true;
      }
      return false;
    } catch (e: any) {
      if (e?.name === "AbortError") return false;
      return false;
    }
  }, []);

  const navigateTo = useCallback(
    async (raw: string, opts?: { replaceHistory?: boolean; forceProxy?: boolean }) => {
      const normalized = normalizeUrl(raw);
      if (!normalized) {
        setError("無効なURLです。http:// または https:// で始まるURLを入力してください。");
        setStatusText("Navigation canceled");
        return;
      }
      setError(null);
      setStatusText(`Opening ${normalized}...`);
      setLoading(true);

      // history handling - use ref to avoid stale closure
      const curIdx = hIndexRef.current;
      if (!opts?.replaceHistory) {
        setHistoryStack((prev) => {
          const truncated = prev.slice(0, curIdx + 1);
          if (truncated[truncated.length - 1] === normalized) return prev;
          const next = [...truncated, normalized];
          // update index to point to new entry
          setHIndex(next.length - 1);
          return next;
        });
      } else {
        setHistoryStack((prev) => {
          const next = [...prev];
          next[curIdx] = normalized;
          return next;
        });
      }

      setCurrentUrl(normalized);
      setAddress(normalized);

      if (opts?.forceProxy) {
        setUseProxy(true);
        return;
      }

      // Auto probe: if blocked, switch to proxy
      setUseProxy(false);
      const shouldProxy = await doProbe(normalized);
      if (shouldProxy) {
        setUseProxy(true);
        setStatusText(`互換表示(プロキシ経由)で開いています: ${normalized}`);
      }
    },
    [doProbe],
  );

  // Keep hIndex in sync when historyStack changes externally (initial)
  // Fix hIndex after history push – ensure it points to last element
  useEffect(() => {
    if (hIndex >= historyStack.length) {
      setHIndex(historyStack.length - 1);
    }
    if (hIndex < 0 && historyStack.length > 0) {
      setHIndex(0);
    }
  }, [historyStack, hIndex]);

  const goBack = () => {
    if (hIndex <= 0) return;
    const nextIdx = hIndex - 1;
    const url = historyStack[nextIdx];
    setHIndex(nextIdx);
    setError(null);
    setStatusText(`Opening ${url}...`);
    setLoading(true);
    setCurrentUrl(url);
    setAddress(url);
    // probe for back navigation as well
    doProbe(url).then((blocked) => {
      setUseProxy(blocked);
    });
  };

  const goForward = () => {
    if (hIndex >= historyStack.length - 1) return;
    const nextIdx = hIndex + 1;
    const url = historyStack[nextIdx];
    setHIndex(nextIdx);
    setError(null);
    setStatusText(`Opening ${url}...`);
    setLoading(true);
    setCurrentUrl(url);
    setAddress(url);
    doProbe(url).then((blocked) => {
      setUseProxy(blocked);
    });
  };

  const handleRefresh = () => {
    if (!currentUrl) return;
    setError(null);
    setLoading(true);
    setStatusText(`Refreshing ${currentUrl}...`);
    // Force iframe reload by resetting src via key or re-setting useProxy
    // Do fresh probe as headers may have changed
    doProbe(currentUrl).then((blocked) => {
      if (blocked && !useProxy) setUseProxy(true);
      else if (!blocked && useProxy) {
        // keep proxy if user manually enabled; otherwise stay direct
        // We keep current useProxy to avoid flicker
      }
      // Trigger reload by briefly clearing and resetting iframe src
      // Instead, we change iframe key by appending timestamp via state
      setReloadKey((k) => k + 1);
    });
  };

  const [reloadKey, setReloadKey] = useState(0);

  const handleStop = () => {
    setLoading(false);
    setStatusText("Navigation stopped");
    // Try to stop iframe loading
    if (iframeRef.current) {
      try {
        iframeRef.current.src = "about:blank";
        // restore after tick
        setTimeout(() => {
          if (iframeRef.current && currentUrl) {
            iframeRef.current.src = iframeSrc;
          }
        }, 0);
      } catch {}
    }
  };

  const handleGo = () => {
    navigateTo(address);
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      navigateTo(address);
    }
  };

  const handleIframeLoad = () => {
    setLoading(false);
    setStatusText(useProxy ? `互換表示(プロキシ経由): ${currentUrl}` : `Document done: ${currentUrl}`);
    setError(null);
  };

  const handleIframeError = () => {
    setLoading(false);
    if (!useProxy) {
      // Auto switch to proxy on error
      setStatusText("表示に失敗しました。互換表示に切り替えています...");
      setUseProxy(true);
    } else {
      setError("ページの読み込みに失敗しました。外部ブラウザで開いてみてください。");
      setStatusText("Error loading document");
    }
  };

  // Also auto-switch to proxy if direct load seems blocked after 2.5s
  // We use a timeout that checks if iframe content is inaccessible (cross-origin check)
  // Cross-origin normally throws, which means it loaded. If it doesn't throw and body is empty, likely blocked.
  useEffect(() => {
    if (!currentUrl || useProxy || loading === false) return;
    const t = setTimeout(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument;
        // If we can access document and it's empty or contains our error page, switch to proxy
        if (doc) {
          const bodyText = doc.body?.innerText?.slice(0, 200) || "";
          const title = doc.title || "";
          // Heuristic: blank or browser error page
          if (!bodyText && !title) {
            setUseProxy(true);
            setStatusText("直接表示がブロックされたため互換表示に切り替えました");
          } else if (bodyText.includes("Refused to display") || bodyText.includes("X-Frame-Options") || title.includes("Error")) {
            setUseProxy(true);
            setStatusText("直接表示がブロックされたため互換表示に切り替えました");
          }
        }
      } catch {
        // Cross-origin access throws -> means direct load succeeded (not blocked) -> do nothing
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [currentUrl, useProxy, loading, reloadKey]);

  // Initial probe for default URL
  useEffect(() => {
    doProbe(currentUrl).then((blocked) => {
      if (blocked) setUseProxy(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canBack = hIndex > 0;
  const canForward = hIndex < historyStack.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", minHeight: 320 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <Button size="sm" disabled={!canBack} onClick={goBack}>
          ◀ Back
        </Button>
        <Button size="sm" disabled={!canForward} onClick={goForward}>
          ▶ Forward
        </Button>
        <Button size="sm" onClick={handleRefresh} disabled={!currentUrl}>
          Refresh
        </Button>
        <Button size="sm" onClick={handleStop} disabled={!loading}>
          Stop
        </Button>
        <TextInput
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleAddressKeyDown}
          placeholder="https://example.com"
          style={{ flex: 1, minWidth: 160 }}
        />
        <Button onClick={handleGo} disabled={loading}>
          Go
        </Button>
        <Button
          size="sm"
          title="外部ブラウザで開く"
          onClick={() => {
            const u = normalizeUrl(address) || currentUrl;
            if (u) window.open(u, "_blank", "noopener");
          }}
        >
          ↗
        </Button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Checkbox
          checked={useProxy}
          onChange={() => setUseProxy((v) => !v)}
          label="互換表示(プロキシ経由)"
          value="proxy"
        />
        {probeInfo && useProxy && (
          <span style={{ fontSize: 10, color: "#808000", background: "#ffffe1", border: "1px solid #c0c0c0", padding: "1px 4px" }}>
            自動切替: {probeInfo}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#808080" }}>
          {useProxy ? "via /api/proxy" : "direct"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <Button size="sm" onClick={() => window.open(currentUrl, "_blank", "noopener")}>
            外部で開く
          </Button>
          <Button size="sm" onClick={() => window.open(`/api/proxy?url=${encodeURIComponent(currentUrl)}`, "_blank", "noopener")}>
            View Source
          </Button>
        </div>
      </div>

      {loading && <ProgressBar value={60} style={{ height: 12 }} />}

      {/* Quick links */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
        <span style={{ fontWeight: "bold" }}>お気に入り:</span>
        {QUICK_LINKS.map((u) => (
          <Anchor
            key={u}
            onClick={() => navigateTo(u)}
            style={{ cursor: "pointer", fontSize: 11 }}
          >
            {u.replace("https://", "")}
          </Anchor>
        ))}
        <Anchor onClick={() => navigateTo("https://www.wenge.co.jp/")} style={{ cursor: "pointer", fontSize: 11 }}>
          wenge.co.jp
        </Anchor>
      </div>

      {error && (
        <Frame variant="well" style={{ background: "#ffffe1", padding: "6px 8px", fontSize: 11, color: "#800000", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>⚠ {error}</span>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {!useProxy && (
              <Button size="sm" onClick={() => setUseProxy(true)}>
                互換表示で再試行
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                const u = normalizeUrl(address) || currentUrl;
                if (u) window.open(u, "_blank", "noopener");
              }}
            >
              外部で開く
            </Button>
          </div>
        </Frame>
      )}

      {/* Iframe container */}
      <div
        style={{
          flex: 1,
          minHeight: 260,
          background: "#fff",
          border: "2px inset #fff",
          padding: 2,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, position: "relative", background: "#fff", overflow: "hidden", display: "flex" }}>
          <iframe
            key={`${iframeSrc}::${reloadKey}::${useProxy ? "proxy" : "direct"}`}
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
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.7)",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                color: "#000080",
              }}
            >
              Loading {currentUrl}...
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, background: "#c0c0c0", border: "2px inset", padding: "2px 6px", display: "flex", justifyContent: "space-between", gap: 8, overflow: "hidden" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{statusText}</span>
        <span style={{ flexShrink: 0, color: "#808080" }}>{useProxy ? "Proxy" : "Direct"} | {historyStack.length} pages</span>
      </div>

      <div style={{ fontSize: 10, color: "#808080", lineHeight: 1.4 }}>
        ヒント: アドレスバーに <code>example.com</code> のように入力して Enter。表示されない場合は自動で互換表示に切り替わります。http/https のみ対応。
      </div>
    </div>
  );
}
