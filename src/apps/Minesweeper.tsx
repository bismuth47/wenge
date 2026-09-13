import { useState } from "react";
import { Button } from "react95";

const SIZE = 8;
const MINES = 10;

function createBoard() {
  const board = Array(SIZE)
    .fill(0)
    .map(() => Array(SIZE).fill(0).map(() => ({ mine: false, revealed: false, flagged: false, adj: 0 })));
  let placed = 0;
  while (placed < MINES) {
    const x = Math.floor(Math.random() * SIZE);
    const y = Math.floor(Math.random() * SIZE);
    if (!board[y][x].mine) {
      board[y][x].mine = true;
      placed++;
    }
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x].mine) continue;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (board[y + dy]?.[x + dx]?.mine) c++;
      board[y][x].adj = c;
    }
  }
  return board;
}

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adj: number };

export function MinesweeperApp() {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [gameOver, setGameOver] = useState(false);

  const reveal = (x: number, y: number) => {
    if (gameOver || board[y][x].revealed || board[y][x].flagged) return;
    const nb = board.map((row) => row.map((c) => ({ ...c })));
    if (nb[y][x].mine) {
      nb[y][x].revealed = true;
      setBoard(nb);
      setGameOver(true);
      return;
    }
    const flood = (cx: number, cy: number) => {
      if (cx < 0 || cx >= SIZE || cy < 0 || cy >= SIZE) return;
      const cell = nb[cy][cx];
      if (cell.revealed || cell.flagged) return;
      cell.revealed = true;
      if (cell.adj === 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) flood(cx + dx, cy + dy);
    };
    flood(x, y);
    setBoard(nb);
  };

  const flag = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (gameOver || board[y][x].revealed) return;
    const nb = board.map((row) => row.map((c) => ({ ...c })));
    nb[y][x].flagged = !nb[y][x].flagged;
    setBoard(nb);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Button onClick={() => { setBoard(createBoard()); setGameOver(false); }}>New Game</Button>
        <span style={{ fontSize: 11 }}>{gameOver ? "💥 Game Over" : "🚩 Right-click to flag"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${SIZE}, 28px)`, gap: 2, background: "#c0c0c0", padding: 6, border: "2px inset #fff" }}>
        {board.map((row, y) =>
          row.map((cell, x) => (
            <button
              key={`${x}-${y}`}
              onClick={() => reveal(x, y)}
              onContextMenu={(e) => flag(e, x, y)}
              style={{
                width: 28,
                height: 28,
                fontSize: 12,
                fontWeight: "bold",
                background: cell.revealed ? "#fff" : "#c0c0c0",
                border: cell.revealed ? "1px solid #808080" : "2px outset #fff",
                cursor: "url('/cursors/hand.png') 12 0, pointer",
              }}
            >
              {cell.flagged ? "🚩" : cell.revealed ? (cell.mine ? "💣" : cell.adj || "") : ""}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
