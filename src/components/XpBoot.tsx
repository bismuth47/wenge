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

const WindowsText = styled.span`
  font-size: 52px;
  font-weight: 400;
  letter-spacing: -1px;
  color: #fff;
`;

const XpText = styled.span`
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

const loadBar = keyframes`
  0% { transform: translateX(-140px); }
  100% { transform: translateX(190px); }
`;

const BarOuter = styled.div`
  margin-top: 42px;
  width: 180px;
  height: 16px;
  border: 1px solid #8a8a8a;
  border-radius: 3px;
  padding: 2px;
  box-sizing: border-box;
  background: #000;
  overflow: hidden;
`;

const BarInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const BarBlocks = styled.div`
  display: flex;
  gap: 3px;
  animation: ${loadBar} 1.6s linear infinite;
  width: max-content;
`;

const BarBlock = styled.div`
  width: 12px;
  height: 10px;
  background: linear-gradient(to bottom, #8ba7e8 0%, #245edc 50%, #1c46a8 100%);
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
        Microsoft<sup style={{ fontSize: 9 }}>&reg;</sup> Windows<sup style={{ fontSize: 9 }}>&reg;</sup>
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
          <WindowsText>Windows</WindowsText>
          <XpText>xp</XpText>
        </div>
      </BrandMain>
      <EditionText>wenge Edition</EditionText>
      <BarOuter aria-label="Loading">
        <BarInner>
          <BarBlocks>
            <BarBlock />
            <BarBlock />
            <BarBlock />
          </BarBlocks>
        </BarInner>
      </BarOuter>
      <Footer>
        <span>Copyright &copy; Microsoft Corporation</span>
        <span>wenge</span>
      </Footer>
    </BootScreen>
  );
}
