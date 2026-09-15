import React, { useCallback, useRef } from "react";
import styled from "styled-components";
import { Button, Window, WindowContent, WindowHeader } from "react95";
import { Win95Scroll } from "./Win95Scroll";
import { CloseGlyph, MaximizeGlyph, MinimizeGlyph, RestoreGlyph } from "./CaptionGlyphs";

const StyledWindow = styled(Window)<{ $x: number; $y: number; $w: number; $h: number; $z: number; $maximized: boolean }>`
  position: absolute !important;
  left: ${(p) => (p.$maximized ? 0 : p.$x)}px;
  top: ${(p) => (p.$maximized ? 0 : p.$y)}px;
  width: ${(p) => (p.$maximized ? "100%" : p.$w + "px")};
  height: ${(p) => (p.$maximized ? "100%" : p.$h + "px")};
  z-index: ${(p) => p.$z};
  display: flex;
  flex-direction: column;
  max-width: var(--wenge-max-w, 100vw);
  max-height: var(--wenge-max-h, 100dvh);
  @media (max-width: 600px) {
    /* 小さい画面では最大幅を画面幅に制限 */
    max-width: calc(100vw - 8px);
  }
`;

const Header = styled(WindowHeader)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: url('/cursors/move.png') 16 16, move;
  user-select: none;
  touch-action: none;
`;

const Controls = styled.div`
  display: flex;
  gap: 2px;
`;

const GlyphWrap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Content = styled(WindowContent)`
  flex: 1;
  /* macOSオーバーレイ対策: ネイティブバーは GlobalStyles で非表示化し、
     スクロールUIは内側の Win95Scroll (divベース) が描画する */
  overflow: hidden;
  position: relative;
  display: flex;
  height: 100%;
  /* react95既定の padding:16px を潰し、IE等のコンテンツを縁まで広げる */
  padding: 0;
`;

const ResizeHandle = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: url('/cursors/size_nwse.png') 16 16, nwse-resize;
  background: transparent;
  touch-action: none;
  &:after {
    content: "";
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-bottom: 6px solid #808080;
    border-right: 6px solid #808080;
    border-top: 6px solid transparent;
  }
`;

export type WindowFrameProps = {
  id: string;
  title: string;
  icon?: string;
  iconSrc?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  maximized?: boolean;
  active?: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  children: React.ReactNode;
  /** 仮想解像度の描画スケール。マウス移動量を論理pxに換算する (default 1) */
  scale?: number;
};

export function WindowFrame({
  id,
  title,
  icon,
  iconSrc,
  x,
  y,
  width,
  height,
  zIndex,
  maximized,
  active,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onMove,
  onResize,
  children,
  scale = 1,
}: WindowFrameProps) {
  // Pointer Eventsベースの自作ドラッグ: ネイティブDnDを一切使わないため、
  // 移動・リサイズ中もカスタムカーソル (move.png等) が維持される。
  // setPointerCaptureでウィンドウ外に外れても追跡を継続する。
  const dragRef = useRef<{ pid: number; ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resizeRef = useRef<{ pid: number; sx: number; sy: number; sw: number; sh: number } | null>(null);

  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // コントロールボタン上では移動を開始しない
      if ((e.target as HTMLElement).closest("button")) return;
      if (maximized || e.button !== 0) return;
      onFocus();
      dragRef.current = { pid: e.pointerId, ox: e.clientX, oy: e.clientY, sx: x, sy: y };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [x, y, maximized, onFocus]
  );

  const handleHeaderPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pid !== e.pointerId) return;
      const s = scale > 0 ? scale : 1;
      onMove(d.sx + (e.clientX - d.ox) / s, d.sy + (e.clientY - d.oy) / s);
    },
    [onMove, scale]
  );

  const endHeaderDrag = useCallback((e: React.PointerEvent) => {
    if (dragRef.current && dragRef.current.pid === e.pointerId) dragRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      onFocus();
      resizeRef.current = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, sw: width, sh: height };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [width, height, onFocus]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeRef.current;
      if (!r || r.pid !== e.pointerId) return;
      const s = scale > 0 ? scale : 1;
      // 最小サイズは画面幅に応じて可変（モバイルでは200pxまで縮小可）
      const minW = window.innerWidth < 600 ? 200 : 260;
      const minH = 180;
      onResize(
        Math.max(minW, r.sw + (e.clientX - r.sx) / s),
        Math.max(minH, r.sh + (e.clientY - r.sy) / s)
      );
    },
    [onResize, scale]
  );

  const endResizeDrag = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current && resizeRef.current.pid === e.pointerId) resizeRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  return (
    <StyledWindow data-window data-window-id={id} $x={x} $y={y} $w={width} $h={height} $z={zIndex} $maximized={!!maximized} onMouseDown={onFocus}>
      <Header
        active={!!active}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
<span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {iconSrc ? (
              <img
                src={iconSrc}
                alt=""
                width={16}
                height={16}
                style={{ imageRendering: "pixelated" as const, flexShrink: 0 }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const fallback = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "inline";
                }}
              />
            ) : null}
            {icon && <span style={{ display: iconSrc ? "none" : "inline", flexShrink: 0 }}>{icon}</span>}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{title}</span>
          </span>
        <Controls>
          <Button square size="sm" onClick={onMinimize} title="最小化">
            <GlyphWrap>
              <MinimizeGlyph size={9} />
            </GlyphWrap>
          </Button>
          <Button square size="sm" onClick={onMaximize} title={maximized ? "元に戻す" : "最大化"}>
            <GlyphWrap>{maximized ? <RestoreGlyph size={10} /> : <MaximizeGlyph size={9} />}</GlyphWrap>
          </Button>
          <Button square size="sm" onClick={onClose} title="閉じる">
            <GlyphWrap>
              <CloseGlyph size={10} />
            </GlyphWrap>
          </Button>
        </Controls>
      </Header>
      <Content>
        <Win95Scroll style={{ flex: 1, minHeight: 0 }}>{children}</Win95Scroll>
      </Content>
      {!maximized && (
        <ResizeHandle
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={endResizeDrag}
          onPointerCancel={endResizeDrag}
        />
      )}
    </StyledWindow>
  );
}
