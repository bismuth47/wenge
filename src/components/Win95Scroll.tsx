import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

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
};

export function Win95Scroll({ children, className, style, autoHide = false, step = 40 }: Win95ScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackVRef = useRef<HTMLDivElement>(null);
  const trackHRef = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ thumbH: 0, thumbTop: 0, visible: false });
  const [h, setH] = useState({ thumbW: 0, thumbLeft: 0, visible: false });

  const update = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = el;
    const vVisible = scrollHeight > clientHeight + 1;
    const hVisible = scrollWidth > clientWidth + 1;
    if (vVisible) {
      const trackH = Math.max(0, clientHeight - BAR * 2);
      const thumbH = Math.max(BAR, (clientHeight / scrollHeight) * trackH);
      const maxTop = Math.max(1, trackH - thumbH);
      const ratio = scrollHeight - clientHeight <= 0 ? 0 : scrollTop / (scrollHeight - clientHeight);
      setV({ thumbH, thumbTop: ratio * maxTop, visible: true });
    } else {
      setV((p) => (p.visible ? { thumbH: 0, thumbTop: 0, visible: false } : p));
    }
    if (hVisible) {
      const trackW = Math.max(0, clientWidth - BAR * 2);
      const thumbW = Math.max(BAR, (clientWidth / scrollWidth) * trackW);
      const maxLeft = Math.max(1, trackW - thumbW);
      const ratio = scrollWidth - clientWidth <= 0 ? 0 : scrollLeft / (scrollWidth - clientWidth);
      setH({ thumbW, thumbLeft: ratio * maxLeft, visible: true });
    } else {
      setH((p) => (p.visible ? { thumbW: 0, thumbLeft: 0, visible: false } : p));
    }
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollByLine = useCallback((dx: number, dy: number) => {
    viewportRef.current?.scrollBy({ left: dx, top: dy, behavior: "auto" });
  }, []);

  // 長押しリピート用
  const holdTimer = useRef<number | null>(null);
  const startHold = useCallback(
    (fn: () => void) => {
      fn();
      window.setTimeout(() => {
        holdTimer.current = window.setInterval(fn, 50);
      }, 350);
    },
    []
  );
  const stopHold = useCallback(() => {
    if (holdTimer.current != null) {
      window.clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);
  useEffect(() => () => stopHold(), [stopHold]);

  const onTrackVClick = useCallback(
    (e: React.MouseEvent) => {
      const el = viewportRef.current;
      const track = trackVRef.current;
      if (!el || !track) return;
      if ((e.target as HTMLElement).closest("[data-thumb]")) return;
      const rect = track.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
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
      const clickX = e.clientX - rect.left;
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
    const trackH = Math.max(1, track.clientHeight - v.thumbH);
    const range = Math.max(1, el.scrollHeight - el.clientHeight);
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY;
      el.scrollTop = startTop + (dy / trackH) * range;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [v.thumbH]);

  const onThumbHDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = viewportRef.current;
    const track = trackHRef.current;
    if (!el || !track) return;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    const trackW = Math.max(1, track.clientWidth - h.thumbW);
    const range = Math.max(1, el.scrollWidth - el.clientWidth);
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      el.scrollLeft = startLeft + (dx / trackW) * range;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [h.thumbW]);

  const showV = v.visible && (!autoHide || v.visible);
  const showH = h.visible && (!autoHide || h.visible);
  // autoHide=false でもスクール不要時は隠す (Win95でも不要時はバー領域は表示されるが、
  // レイアウト崩れ防止のためここでは非表示にする。常時枠が必要なら showV||true に変更)
  const renderV = autoHide ? showV : v.visible;
  const renderH = autoHide ? showH : h.visible;

  return (
    <Wrap className={className} style={style}>
      <BodyRow>
        <Viewport ref={viewportRef} className="win95-viewport" tabIndex={0}>
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
