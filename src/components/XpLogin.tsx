import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { Button, TextInput } from "react95";
import { SOUNDS, applyMasterVolume } from "../hooks/useSound";
import { ICONS } from "../assets/icons";

// Hard-coded login password (spec: 4747).
// To make it configurable later, read from import.meta.env.VITE_LOGIN_PASSWORD here.
const LOGIN_PASSWORD = "4747";

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: #245edc;
  font-family: Tahoma, Verdana, "Segoe UI", sans-serif;
  user-select: none;
  cursor: url('/cursors/arrow.png') 0 0, default;
`;

const TopBar = styled.div`
  height: 84px;
  flex-shrink: 0;
  background: linear-gradient(to bottom, #0f2f9e 0%, #245edc 60%, #245edc 100%);
  border-bottom: 2px solid #e8631c;
  display: flex;
  align-items: center;
  padding: 0 32px;
  box-sizing: border-box;
`;

const TopTitle = styled.div`
  color: #fff;
  font-size: 26px;
  font-style: italic;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
`;

const TopSub = styled.div`
  color: #cdd9f8;
  font-size: 12px;
  margin-left: 12px;
  margin-top: 10px;
`;

const Middle = styled.div`
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  background: linear-gradient(to right, #3b6de0 0%, #5a7edc 30%, #5a7edc 70%, #3b6de0 100%);
  min-height: 0;
  overflow: auto;
  padding: 24px 16px;
  box-sizing: border-box;
`;

const MiddleInner = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  width: min(680px, 94vw);
  margin: auto;
`;

const LeftPane = styled.div`
  flex: 1;
  color: #fff;
  padding: 12px 28px 12px 8px;
  text-align: right;
`;

const LeftLogo = styled.div`
  font-size: 30px;
  font-weight: 700;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.45);
`;

const LeftMsg = styled.div`
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #e8eefc;
`;

const Divider = styled.div`
  width: 2px;
  align-self: stretch;
  min-height: 180px;
  background: linear-gradient(to bottom, transparent, #e8631c 20%, #e8631c 80%, transparent);
  flex-shrink: 0;
`;
const RightPane = styled.div`
  flex: 1.2;
  padding: 12px 8px 12px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const UserCard = styled.button<{ $error?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${(p) => (p.$error ? "rgba(160,0,0,0.35)" : "rgba(255,255,255,0.12)")};
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-family: inherit;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
`;

const Avatar = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 2px solid #fff;
  background: #fff;
  object-fit: cover;
  flex-shrink: 0;
`;

const UserName = styled.div`
  font-size: 17px;
`;

const UserHint = styled.div`
  font-size: 11px;
  color: #d6e1fa;
  margin-top: 2px;
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
`;

const LoginBox = styled.div<{ $shakeKey: number }>`
  background: rgba(0, 0, 60, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: ${(p) => (p.$shakeKey > 0 ? shake : "none")} 0.4s ease;
`;

const LoginLabel = styled.label`
  color: #fff;
  font-size: 12px;
  /* ログイン画面はarrow.pngカーソルを基本とする。ラベル上でビームカーソルが
     表示されてしまうのを防ぐため、親のScreenカーソルを継承させる。 */
  cursor: inherit;
`;

const LoginRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ErrorMsg = styled.div`
  background: #ffffe1;
  border: 1px solid #000;
  color: #000;
  font-size: 12px;
  padding: 8px 10px;
  line-height: 1.5;
`;


const BottomBar = styled.div`
  height: 84px;
  flex-shrink: 0;
  background: linear-gradient(to bottom, #245edc 0%, #0f2f9e 100%);
  border-top: 2px solid #e8631c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  box-sizing: border-box;
  color: #fff;
  font-size: 12px;
`;

const TurnOffBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  padding: 6px 10px;
`;

const PowerIcon = styled.span`
  width: 26px;
  height: 26px;
  border-radius: 5px;
  background: linear-gradient(to bottom, #e8631c, #b33f0a);
  border: 1px solid #fff;
  display: grid;
  place-items: center;
  font-size: 14px;
`;

export function XpLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const playError = () => {
    try {
      if (!errorSoundRef.current) {
        errorSoundRef.current = new Audio(SOUNDS.error);
        errorSoundRef.current.preload = "auto";
      }
      const a = errorSoundRef.current;
      applyMasterVolume(a, 0.5);
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };

  const submit = () => {
    if (busy) return;
    if (password === LOGIN_PASSWORD) {
      setError(false);
      setBusy(true);
      onSuccess();
    } else {
      playError();
      setError(true);
      setShakeKey((k) => k + 1);
      setPassword("");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <Screen>
      <TopBar>
        <TopTitle>wenge<sup style={{ fontSize: 12 }}>xp</sup></TopTitle>
        <TopSub>To begin, log on to Windows</TopSub>
      </TopBar>
      <Middle>
        <MiddleInner>
          <LeftPane>
            <LeftLogo>welcome</LeftLogo>
            <LeftMsg>Type your password and click<br />the arrow button to log on.</LeftMsg>
          </LeftPane>
          <Divider />
          <RightPane>
            <UserCard type="button" $error={error} onClick={() => inputRef.current?.focus()}>
              <Avatar src={ICONS.myComputer} alt="Owner" draggable={false} />
              <div>
                <UserName>Owner</UserName>
                <UserHint>Administrator</UserHint>
              </div>
            </UserCard>
            <LoginBox $shakeKey={shakeKey} key={shakeKey}>
              <LoginLabel htmlFor="xp-password">Password</LoginLabel>
              <LoginRow>
                <TextInput
                  id="xp-password"
                  ref={inputRef as never}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  style={{ flex: 1 }}
                  autoComplete="current-password"
                />
                <Button onClick={submit} disabled={busy} style={{ minWidth: 40 }} title="Log on">
                  <span style={{ fontSize: 14, fontWeight: "bold", color: "#0f2f9e" }}>&#10148;</span>
                </Button>
              </LoginRow>
              {error && (
                <ErrorMsg>
                  Did you forget your password? Please type the password again.
                </ErrorMsg>
              )}
            </LoginBox>
          </RightPane>
        </MiddleInner>
      </Middle>
      <BottomBar>
        <span>After you log on, you can use Windows Update to update Windows.</span>
        <TurnOffBtn
          type="button"
          onClick={() => {
            if (window.confirm("Turn off wenge?")) {
              try {
                const a = new Audio(SOUNDS.shutdown);
                applyMasterVolume(a, 0.5);
                a.play().catch(() => {});
              } catch {}
              window.setTimeout(() => window.location.reload(), 1200);
            }
          }}
        >
          <PowerIcon>&#9211;</PowerIcon>
          Turn off computer
        </TurnOffBtn>
      </BottomBar>
    </Screen>
  );
}
