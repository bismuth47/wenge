// Win95風ドット絵キャプショングリフ (× / □ / 元に戻す / _)。
// SVG rect + crispEdges でドットを潰さず描画する。色は currentColor。
type GlyphProps = { size?: number };

function PixelGlyph({ rows, size = 10 }: { rows: string[]; size?: number }) {
  const w = rows[0].length;
  const h = rows.length;
  const height = Math.round((size * h) / w);
  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {rows.map((row, y) =>
        row.split("").map((ch, x) =>
          ch === "X" ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}

const CLOSE_10 = [
  "XX......XX",
  "XXX....XXX",
  ".XXX..XXX.",
  "..XXXXXX..",
  "...XXXX...",
  "...XXXX...",
  "..XXXXXX..",
  ".XXX..XXX.",
  "XXX....XXX",
  "XX......XX",
];

const CLOSE_8 = [
  "XX....XX",
  "XXX..XXX",
  ".XXXXXX.",
  "..XXXX..",
  "..XXXX..",
  ".XXXXXX.",
  "XXX..XXX",
  "XX....XX",
];

const MAXIMIZE_9 = [
  "XXXXXXXXXX",
  "XXXXXXXXXX",
  "XX......XX",
  "XX......XX",
  "XX......XX",
  "XX......XX",
  "XX......XX",
  "XX......XX",
  "XXXXXXXXXX",
  "XXXXXXXXXX",
];

const RESTORE_10 = [
  "....XXXXXXXXXX",
  "....XXXXXXXXXX",
  "....XX......XX",
  "....XX......XX",
  "XXXXXXXXXX..XX",
  "XXXXXXXXXX..XX",
  "XX......XX..XX",
  "XX......XX..XX",
  "XX......XX..XX",
  "XX......XXXXXX",
  "XX......XXXXXX",
  "XX......XX....",
  "XX......XX....",
  "XXXXXXXXXX....",
  "XXXXXXXXXX....",
];

const MINIMIZE_9 = [
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  ".........",
  "XXXXXXXXX",
  "XXXXXXXXX",
];

export function CloseGlyph({ size = 10 }: GlyphProps) {
  return <PixelGlyph rows={size <= 8 ? CLOSE_8 : CLOSE_10} size={size} />;
}

export function MaximizeGlyph({ size = 9 }: GlyphProps) {
  return <PixelGlyph rows={MAXIMIZE_9} size={size} />;
}

export function RestoreGlyph({ size = 10 }: GlyphProps) {
  return <PixelGlyph rows={RESTORE_10} size={size} />;
}

export function MinimizeGlyph({ size = 9 }: GlyphProps) {
  return <PixelGlyph rows={MINIMIZE_9} size={size} />;
}
