import { useEffect } from "react";
import styled, { keyframes } from "styled-components";

const BootScreen = styled.div`
  position: fixed;
  inset: 0;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  user-select: none;
  font-family: Tahoma, Verdana, "Segoe UI", sans-serif;
  cursor: url('/cursors/arrow.png') 0 0, default;
`;

const BrandSmall = styled.div`
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0.5px;
  align-self: flex-start;
  margin-left: max(24px, calc(50% - 210px));
  margin-bottom: 2px;
  color: #fff;
`;

const BrandMain = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1;
`;

const BrandText = styled.span`
  font-size: 52px;
  font-weight: 400;
  letter-spacing: -1px;
  color: #fff;
`;

const Mark95x = styled.span`
  font-size: 52px;
  font-weight: 800;
  color: #e8631c;
  letter-spacing: -1px;
  margin-left: 8px;
`;

const EditionText = styled.div`
  font-size: 15px;
  font-weight: 400;
  color: #fff;
  align-self: flex-start;
  margin-left: max(24px, calc(50% - 210px));
  margin-top: 6px;
  letter-spacing: 0.5px;
`;

const Flag = styled.div`
  width: 72px;
  height: 62px;
  position: relative;
  flex-shrink: 0;
  margin-top: 2px;
`;

// --- Authentic XP loader ---
// Real XP boot bar does NOT glide: blue cells jump forward one cell-width
// per tick (~10 ticks/sec), like a chunky conveyor. steps(17) over a
// travel of exactly 17 cell-pitches (17 x 11px) reproduces that stepping.
const xpMarch = keyframes`
  from { transform: translateX(-33px); }
  to { transform: translateX(154px); }
`;

const BarOuter = styled.div`
  margin-top: 42px;
  width: 156px;
  height: 17px;
  border: 1px solid #808080;
  border-radius: 2px;
  padding: 2px;
  box-sizing: border-box;
  background: #000;
  overflow: hidden;
`;

const BarTrack = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const BarCluster = styled.div`
  display: flex;
  gap: 2px;
  width: max-content;
  animation: ${xpMarch} 1.7s steps(17) infinite;
`;

const BarCell = styled.div`
  width: 9px;
  height: 11px;
  background: linear-gradient(to bottom, #6a6ae6 0%, #3333cc 45%, #1a1a9e 100%);
`;

const Footer = styled.div`
  position: absolute;
  bottom: 28px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 28px;
  font-size: 12px;
  color: #fff;
  box-sizing: border-box;
`;

export function XpBoot({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 3800);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <BootScreen
      onClick={onDone}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDone();
      }}
      tabIndex={0}
      title="Click to skip"
    >
      <BrandSmall>
        Wenge<sup style={{ fontSize: 9 }}>&reg;</sup>
      </BrandSmall>
      <BrandMain>
        <Flag aria-hidden>
          <svg viewBox="0 0 72 62" width="72" height="62">
            <path d="M4 8 L33 3 L33 28 L4 28 Z" fill="#f65314" opacity="0.95" />
            <path d="M35 3 L66 0 L66 28 L35 28 Z" fill="#7cbb00" opacity="0.95" />
            <path d="M4 30 L33 30 L33 55 L4 50 Z" fill="#00a1f1" opacity="0.95" />
            <path d="M35 30 L66 30 L66 58 L35 55 Z" fill="#ffbb00" opacity="0.95" />
            <path d="M4 28 L66 28" stroke="#000" strokeWidth="1.5" opacity="0.5" />
          </svg>
        </Flag>
        <div>
          <BrandText>Wenge</BrandText>
          <Mark95x>95x</Mark95x>
        </div>
      </BrandMain>
      <EditionText>Professional</EditionText>
      <BarOuter aria-label="Loading">
        <BarTrack>
          <BarCluster>
            <BarCell />
            <BarCell />
            <BarCell />
          </BarCluster>
        </BarTrack>
      </BarOuter>
      <Footer>
        <span>Copyright &copy; Wenge Corporation</span>
        <span>Wenge 95x</span>
      </Footer>
    </BootScreen>
  );
}
