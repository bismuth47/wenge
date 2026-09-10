import { useState } from "react";
import { Button } from "react95";
import { ICONS, ICON_FALLBACK } from "../assets/icons";

type Item = { id: number; name: string; deletedAt: string; size: string };

export function RecycleBinApp({ playSound }: { playSound?: () => void }) {
  const [items, setItems] = useState<Item[]>([
    { id: 1, name: "README.txt", deletedAt: "1995/08/24", size: "12KB" },
    { id: 2, name: "古いメモ.doc", deletedAt: "1995/08/20", size: "45KB" },
    { id: 3, name: "画像.bmp", deletedAt: "1995/08/19", size: "1.2MB" },
  ]);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Button
          onClick={() => {
            setItems([]);
            playSound?.();
          }}
        >
          ごみ箱を空にする
        </Button>
        <Button disabled={items.length === 0} onClick={() => setItems([])}>
          すべて復元
        </Button>
      </div>
      <div style={{ border: "2px inset #fff", background: "#fff", minHeight: 160 }}>
        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#666" }}>ごみ箱は空です</div>
        ) : (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#000080", color: "#fff" }}>
                <th style={{ textAlign: "left", padding: 4 }}>名前</th>
                <th>削除日</th>
                <th>サイズ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #c0c0c0" }}>
                  <td style={{ padding: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <img
                      src={ICONS.fileWindows}
                      alt=""
                      width={16}
                      height={16}
                      style={{ imageRendering: "pixelated" as const }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                        if (fb) fb.style.display = "inline";
                      }}
                    />
                    <span style={{ display: "none" }}>{ICON_FALLBACK.fileWindows}</span>
                    {it.name}
                  </td>
                  <td style={{ textAlign: "center" }}>{it.deletedAt}</td>
                  <td style={{ textAlign: "center" }}>{it.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 11 }}>{items.length} 個のオブジェクト</div>
    </div>
  );
}
