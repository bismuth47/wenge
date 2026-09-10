import React, { useCallback, useRef } from "react";
import styled from "styled-components";
import { Button, Window, WindowContent, WindowHeader } from "react95";

const StyledWindow = styled(Window)<{ $x: number; $y: number; $w: number; $h: number; $z: number; $maximized: boolean }>`
  position: absolute !important;
  left: ${(p) => (p.$maximized ? 0 : p.$x)}px;
  top: ${(p) => (p.$maximized ? 0 : p.$y)}px;
  width: ${(p) => (p.$maximized ? "100%" : p.$w + "px")};
  height: ${(p) => (p.$maximized ? "calc(100% - 30px)" : p.$h + "px")};
  z-index: ${(p) => p.$z};
  display: flex;
  flex-direction: column;
`;

const Header = styled(WindowHeader)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
`;

const Controls = styled.div`
  display: flex;
  gap: 2px;
`;

const Content = styled(WindowContent)`
  flex: 1;
  overflow: auto;
  position: relative;
`;

const ResizeHandle = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: transparent;
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
  title: string;
  icon?: string;
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
};

export function WindowFrame({
  title,
  icon,
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
}: WindowFrameProps) {
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (maximized) return;
      onFocus();
      dragRef.current = { ox: e.clientX, oy: e.clientY, sx: x, sy: y };
      const onMoveMouse = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.ox;
        const dy = ev.clientY - dragRef.current.oy;
        onMove(dragRef.current.sx + dx, dragRef.current.sy + dy);
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMoveMouse);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMoveMouse);
      window.addEventListener("mouseup", onUp);
    },
    [x, y, maximized, onFocus, onMove]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFocus();
      resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: width, sh: height };
      const onMoveMouse = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const dx = ev.clientX - resizeRef.current.sx;
        const dy = ev.clientY - resizeRef.current.sy;
        const nw = Math.max(260, resizeRef.current.sw + dx);
        const nh = Math.max(180, resizeRef.current.sh + dy);
        onResize(nw, nh);
      };
      const onUp = () => {
        resizeRef.current = null;
        window.removeEventListener("mousemove", onMoveMouse);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMoveMouse);
      window.addEventListener("mouseup", onUp);
    },
    [width, height, onFocus, onResize]
  );

  return (
    <StyledWindow $x={x} $y={y} $w={width} $h={height} $z={zIndex} $maximized={!!maximized} onMouseDown={onFocus}>
      <Header active={!!active} onMouseDown={handleHeaderMouseDown}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </span>
        <Controls>
          <Button square size="sm" onClick={onMinimize}>
            <span style={{ fontWeight: "bold" }}>_</span>
          </Button>
          <Button square size="sm" onClick={onMaximize}>
            <span>{maximized ? "❐" : "□"}</span>
          </Button>
          <Button square size="sm" onClick={onClose}>
            <span>×</span>
          </Button>
        </Controls>
      </Header>
      <Content>{children}</Content>
      {!maximized && <ResizeHandle onMouseDown={handleResizeMouseDown} />}
    </StyledWindow>
  );
}
