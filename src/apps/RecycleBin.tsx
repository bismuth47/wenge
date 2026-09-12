import { useState } from "react";
import { Button } from "react95";
import { ICONS, ICON_FALLBACK } from "../assets/icons";
import { showConfirm, showInfo } from "../components/SystemDialog";

type Item = { id: number; name: string; deletedAt: string; size: string };

export function RecycleBinApp({ playSound }: { playSound?: () => void }) {
  const [items, setItems] = useState<Item[]>([
    { id: 1, name: "README.txt", deletedAt: "1995/08/24", size: "12KB" },
    { id: 2, name: "Old Memo.doc", deletedAt: "1995/08/20", size: "45KB" },
    { id: 3, name: "Image.bmp", deletedAt: "1995/08/19", size: "1.2MB" },
  ]);
  const [selected, setSelected] = useState<number | null>(null);
  const restore = (id?: number) => {
    if (items.length === 0) return;
    if (id !== undefined) {
      setItems((p) => p.filter((it) => it.id !== id));
      setSelected(null);
    } else {
      setItems([]);
      setSelected(null);
    }
    playSound?.();
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Button
          disabled={items.length === 0}
          onClick={() => {
            setItems([]);
            setSelected(null);
            playSound?.();
            showInfo("Recycle Bin", "Recycle Bin emptied.");
          }}
        >
          Empty Recycle Bin
        </Button>
        <Button disabled={items.length === 0} onClick={() => { restore(); showInfo("Recycle Bin", "All items restored (mock)."); }}>
          Restore All
        </Button>
      </div>
      <div style={{ border: "2px inset #fff", background: "#fff", minHeight: 160 }}>
        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#666" }}>Recycle Bin is empty</div>
        ) : (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#000080", color: "#fff" }}>
                <th style={{ textAlign: "left", padding: 4 }}>Name</th>
                <th>Date Deleted</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} onClick={() => setSelected(it.id)} onDoubleClick={() => restore(it.id)} style={{ borderBottom: "1px solid #c0c0c0", background: selected === it.id ? "#000080" : "transparent", color: selected === it.id ? "#fff" : "#000", cursor: "pointer" }}>
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
      <div style={{ marginTop: 8, fontSize: 11, display: "flex", gap: 8, alignItems: "center" }}>
        <span>{items.length} object(s)</span>
        <span style={{ flex: 1 }} />
        <Button size="sm" disabled={selected === null} onClick={() => { if (selected !== null) restore(selected); }}>Restore</Button>
        <Button size="sm" disabled={selected === null} onClick={async () => {
          if (selected === null) return;
          const ok = await showConfirm("Recycle Bin", "Delete this item permanently?", "Delete", "Cancel");
          if (ok) { setItems((p) => p.filter((it) => it.id !== selected)); setSelected(null); playSound?.(); }
        }}>Delete</Button>
      </div>
    </div>
  );
}
