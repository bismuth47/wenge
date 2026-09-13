import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { getViewMetrics } from "../lib/display";

// 仮想解像度の描画スケール。画面px計測値を論理pxに換算する (default 1)。
const viewScale = () => {
  const s = getViewMetrics().scale;
  return s > 0 ? s : 1;
};

/**
 * macOSのオーバーレイスクロールバー対策としてのWin95風カスタムスクロールバー。
 *
 * - ネイティブバーは GlobalStyles で `display:none / width:0` により非表示化済み。
 *   (viewport に .win95-viewport を付与)
 * - 見た目は div (.win95-scrollbar) で描画するため、macOSの
 *   「スクロールバーを表示: スクロール時 / 常に表示」設定の影響を受けない。
 * - Windows/Linuxでは従来通りホイール・タッチ・キーボード操作も有効。
 */

const BAR = 16;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
`;

const BodyRow = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
`;

const Viewport = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  &::-webkit-scrollbar {
    display: none !important;
    width: 0px !important;
    height: 0px !important;
    -webkit-appearance: none !important;
  }
  & > * {
    flex: 1 0 auto;
    min-height: 0;
  }
`;

const VBar = styled.div<{ $visible: boolean }>`
  width: ${BAR}px;
  flex: 0 0 ${BAR}px;
  display: ${(p) => (p.$visible ? "flex" : "none")};
  flex-direction: column;
  background: #c0c0c0;
  user-select: none;
`;

const HBar = styled.div<{ $visible: boolean }>`
  height: ${BAR}px;
  flex: 0 0 ${BAR}px;
  display: ${(p) => (p.$visible ? "flex" : "none")};
  flex-direction: row;
  background: #c0c0c0;
  user-select: none;
`;

const Corner = styled.div`
  width: ${BAR}px;
  height: ${BAR}px;
  flex: 0 0 ${BAR}px;
  background: #c0c0c0;
  border-top: 1px solid #dfdfdf;
  border-left: 1px solid #dfdfdf;
  border-right: 1px solid #0a0a0a;
  border-bottom: 1px solid #0a0a0a;
  box-sizing: border-box;
`;

const ArrowBtn = styled.button`
  width: ${BAR}px;
  height: ${BAR}px;
  flex: 0 0 ${BAR}px;
  padding: 0;
  background-color: #c0c0c0;
  border-top: 1px solid #dfdfdf;
  border-left: 1px solid #dfdfdf;
  border-right: 1px solid #0a0a0a;
  border-bottom: 1px solid #0a0a0a;
  box-shadow: inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: inherit;
  box-sizing: border-box;
  &:active {
    border-top: 1px solid #0a0a0a;
    border-left: 1px solid #0a0a0a;
    border-right: 1px solid #dfdfdf;
    border-bottom: 1px solid #dfdfdf;
    box-shadow: inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff;
    & > svg { transform: translate(1px, 1px); }
  }
`;

const TrackV = styled.div`
  flex: 1;
  position: relative;
  background-color: #dfdfdf;
  background-image: repeating-conic-gradient(#ffffff 0% 25%, #c0c0c0 0% 50%);
  background-size: 2px 2px;
  min-height: 0;
`;

const TrackH = styled.div`
  flex: 1;
  position: relative;
  background-color: #dfdfdf;
  background-image: repeating-conic-gradient(#ffffff 0% 25%, #c0c0c0 0% 50%);
  background-size: 2px 2px;
  min-width: 0;
`;

const ThumbV = styled.div`
  position: absolute;
  left: 0;
  width: ${BAR}px;
  background: #c0c0c0;
  border-top: 1px solid #dfdfdf;
  border-left: 1px solid #dfdfdf;
  border-right: 1px solid #0a0a0a;
  border-bottom: 1px solid #0a0a0a;
  box-shadow: inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080;
  box-sizing: border-box;
`;

const ThumbH = styled.div`
  position: absolute;
  top: 0;
  height: ${BAR}px;
  background: #c0c0c0;
  border-top: 1px solid #dfdfdf;
  border-left: 1px solid #dfdfdf;
  border-right: 1px solid #0a0a0a;
  border-bottom: 1px solid #0a0a0a;
  box-shadow: inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080;
  box-sizing: border-box;
`;

function ArrowGlyph({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  const d =
    dir === "up" ? "M8 5 L3 10 H13 Z"
    : dir === "down" ? "M8 11 L3 6 H13 Z"
    : dir === "left" ? "M5 8 L10 3 V13 Z"
    : "M11 8 L6 3 V13 Z";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d={d} fill="black" />
    </svg>
  );
}

export type Win95ScrollProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** false (既定) = Win95らしく常時表示。true = スクロール不要時はバーを隠す */
  autoHide?: boolean;
  step?: number;
  /**
   * ビューポートに直接付与する max-height (例: "calc(100dvh - 88px)")。
   * サブメニューのように祖先の高さが不定 (height:auto + max-heightのみ) の場合、
   * flex-shrink連鎖ではViewportの高さが確定しないため、スクロールコンテナ自身を
   * max-heightで縛るのが最も確実。未指定時は従来通り親の高さに追従する。
   */
  maxHeight?: string | number;
};

export function Win95Scroll({ children, className, style, autoHide = false, step = 40, maxHeight }: Win95ScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackVRef = useRef<HTMLDivElement>(null);
  const trackHRef = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ thumbH: 0, thumbTop: 0, visible: false });
  const [h, setH] = useState({ thumbW: 0, thumbLeft: 0, visible: false });
  // 最新のつまみ寸法をドラッグ計算用に保持 (stale closure対策)
  const geoRef = useRef({ vThumbH: 0, hThumbW: 0 });
  geoRef.current.vThumbH = v.thumbH;
  geoRef.current.hThumbW = h.thumbW;

  const update = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = el;
    // 非表示時(display:none)のトラック実測は 0 になるため、0 の場合は仮定値で
    // ブートストラップする (そうしないと visible:false → 実測0 → 永遠に非表示のデッドロックになる)
    const measuredH = trackVRef.current?.clientHeight ?? 0;
    const measuredW = trackHRef.current?.clientWidth ?? 0;
    const trackH = measuredH > 0 ? measuredH : Math.max(0, clientHeight - BAR * 2);
    const trackW = measuredW > 0 ? measuredW : Math.max(0, clientWidth - BAR * 2);
    const vVisible = scrollHeight > clientHeight + 1;
    const hVisible = scrollWidth > clientWidth + 1;
    if (vVisible && trackH > 0) {
      const thumbH = Math.min(trackH, Math.max(16, (clientHeight / scrollHeight) * trackH));
      const maxTop = Math.max(0, trackH - thumbH);
      const ratio = scrollHeight - clientHeight <= 0 ? 0 : Math.min(1, Math.max(0, scrollTop / (scrollHeight - clientHeight)));
      const thumbTop = ratio * maxTop;
      setV((p) => (p.visible && p.thumbH === thumbH && Math.abs(p.thumbTop - thumbTop) < 0.5 ? p : { thumbH, thumbTop, visible: true }));
    } else {
      setV((p) => (p.visible ? { thumbH: 0, thumbTop: 0, visible: false } : p));
    }
    if (hVisible && trackW > 0) {
      const thumbW = Math.min(trackW, Math.max(16, (clientWidth / scrollWidth) * trackW));
      const maxLeft = Math.max(0, trackW - thumbW);
      const ratio = scrollWidth - clientWidth <= 0 ? 0 : Math.min(1, Math.max(0, scrollLeft / (scrollWidth - clientWidth)));
      const thumbLeft = ratio * maxLeft;
      setH((p) => (p.visible && p.thumbW === thumbW && Math.abs(p.thumbLeft - thumbLeft) < 0.5 ? p : { thumbW, thumbLeft, visible: true }));
    } else {
      setH((p) => (p.visible ? { thumbW: 0, thumbLeft: 0, visible: false } : p));
    }
  }, []);

  // rAFスロットル (scroll連打・MO連鎖による更新ループを防止)
  const rafRef = useRef<number | null>(null);
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      update();
    });
  }, [update]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // 初回はレイアウト確定後に2フレーム待って計測 (absolute配置+maxHeight直後対策)
    const raf1 = requestAnimationFrame(() => {
      update();
      const raf2 = requestAnimationFrame(() => update());
      (el as any).__w95raf2 = raf2;
    });
    el.addEventListener("scroll", scheduleUpdate, { passive: true });
    // viewport自体のリサイズ + コンテンツ寸法の変化(画像・フォント確定等)を両方監視。
    // MO attributes:true はつまみstyle更新との無限ループになるため使わない。
    // ラッパーdivを挟むと height:100% 系レイアウトを壊すため第一子を直接監視する。
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(el);
    let observedChild: Element | null = null;
    const observeChild = () => {
      const first = el.firstElementChild;
      if (first !== observedChild) {
        if (observedChild) ro.unobserve(observedChild);
        observedChild = first;
        if (first) ro.observe(first);
      }
    };
    observeChild();
    const mo = new MutationObserver(() => {
      observeChild();
      scheduleUpdate();
    });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame((el as any).__w95raf2);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      el.removeEventListener("scroll", scheduleUpdate);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [update, scheduleUpdate]);

  const scrollByLine = useCallback((dx: number, dy: number) => {
    viewportRef.current?.scrollBy({ left: dx, top: dy, behavior: "auto" });
  }, []);

  // 長押しリピート用 (timeoutリーク修正: 離したらpendingも破棄)
  const holdTimer = useRef<number | null>(null);
  const holdDelay = useRef<number | null>(null);
  const startHold = useCallback(
    (fn: () => void) => {
      stopHoldInner();
      fn();
      holdDelay.current = window.setTimeout(() => {
        holdDelay.current = null;
        holdTimer.current = window.setInterval(fn, 50);
      }, 350);
    },
    []
  );
  function stopHoldInner() {
    if (holdDelay.current != null) {
      window.clearTimeout(holdDelay.current);
      holdDelay.current = null;
    }
    if (holdTimer.current != null) {
      window.clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }
  const stopHold = useCallback(() => {
    stopHoldInner();
  }, []);
  useEffect(() => () => stopHoldInner(), []);

  const onTrackVClick = useCallback(
    (e: React.MouseEvent) => {
      const el = viewportRef.current;
      const track = trackVRef.current;
      if (!el || !track) return;
      if ((e.target as HTMLElement).closest("[data-thumb]")) return;
      const rect = track.getBoundingClientRect();
      const clickY = (e.clientY - rect.top) / viewScale();
      if (clickY < v.thumbTop) el.scrollBy({ top: -el.clientHeight + 20 });
      else el.scrollBy({ top: el.clientHeight - 20 });
    },
    [v.thumbTop]
  );

  const onTrackHClick = useCallback(
    (e: React.MouseEvent) => {
      const el = viewportRef.current;
      const track = trackHRef.current;
      if (!el || !track) return;
      if ((e.target as HTMLElement).closest("[data-thumb]")) return;
      const rect = track.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / viewScale();
      if (clickX < h.thumbLeft) el.scrollBy({ left: -el.clientWidth + 20 });
      else el.scrollBy({ left: el.clientWidth - 20 });
    },
    [h.thumbLeft]
  );

  const onThumbVDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = viewportRef.current;
    const track = trackVRef.current;
    if (!el || !track) return;
    const startY = e.clientY;
    const startTop = el.scrollTop;
    const onMove = (ev: MouseEvent) => {
      // 計測はイベント時点の実寸で (staleなstateを使わない)
      const tH = Math.max(1, track.clientHeight - (geoRef.current.vThumbH || 16));
      const range = Math.max(1, el.scrollHeight - el.clientHeight);
      const dy = (ev.clientY - startY) / viewScale();
      el.scrollTop = startTop + (dy / tH) * range;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const onThumbHDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = viewportRef.current;
    const track = trackHRef.current;
    if (!el || !track) return;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    const onMove = (ev: MouseEvent) => {
      const tW = Math.max(1, track.clientWidth - (geoRef.current.hThumbW || 16));
      const range = Math.max(1, el.scrollWidth - el.clientWidth);
      const dx = (ev.clientX - startX) / viewScale();
      el.scrollLeft = startLeft + (dx / tW) * range;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const showV = v.visible && (!autoHide || v.visible);
  const showH = h.visible && (!autoHide || h.visible);
  // autoHide=false でもスクール不要時は隠す (Win95でも不要時はバー領域は表示されるが、
  // レイアウト崩れ防止のためここでは非表示にする。常時枠が必要なら showV||true に変更)
  const renderV = autoHide ? showV : v.visible;
  const renderH = autoHide ? showH : h.visible;

  return (
    <Wrap className={className} style={style}>
      <BodyRow>
        <Viewport
          ref={viewportRef}
          className="win95-viewport"
          tabIndex={0}
          style={maxHeight != null ? { maxHeight } : undefined}
        >
          {children}
        </Viewport>
        <VBar className="win95-scrollbar win95-scrollbar-vertical" $visible={renderV} aria-hidden={!renderV}>
          <ArrowBtn
            onMouseDown={() => startHold(() => scrollByLine(0, -step))}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            tabIndex={-1}
          >
            <ArrowGlyph dir="up" />
          </ArrowBtn>
          <TrackV ref={trackVRef} className="win95-scrollbar-track" onMouseDown={onTrackVClick}>
            <ThumbV
              data-thumb
              className="win95-scrollbar-thumb"
              style={{ height: v.thumbH, top: v.thumbTop }}
              onMouseDown={onThumbVDrag}
            />
          </TrackV>
          <ArrowBtn
            onMouseDown={() => startHold(() => scrollByLine(0, step))}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            tabIndex={-1}
          >
            <ArrowGlyph dir="down" />
          </ArrowBtn>
        </VBar>
      </BodyRow>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <HBar className="win95-scrollbar win95-scrollbar-horizontal" $visible={renderH} aria-hidden={!renderH}>
          <ArrowBtn
            onMouseDown={() => startHold(() => scrollByLine(-step, 0))}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            tabIndex={-1}
          >
            <ArrowGlyph dir="left" />
          </ArrowBtn>
          <TrackH ref={trackHRef} className="win95-scrollbar-track" onMouseDown={onTrackHClick}>
            <ThumbH
              data-thumb
              className="win95-scrollbar-thumb"
              style={{ width: h.thumbW, left: h.thumbLeft }}
              onMouseDown={onThumbHDrag}
            />
          </TrackH>
          <ArrowBtn
            onMouseDown={() => startHold(() => scrollByLine(step, 0))}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            tabIndex={-1}
          >
            <ArrowGlyph dir="right" />
          </ArrowBtn>
        </HBar>
        {renderV && renderH ? <Corner /> : null}
      </div>
    </Wrap>
  );
}

export default Win95Scroll;
