import { useCallback, useEffect, useState } from "react";
import { Button, Fieldset, Select, TextInput } from "react95";
import {
  createCodespace,
  deleteCodespace,
  listCodespaces,
  listMachines,
  parseRepo,
  startCodespace,
  stopCodespace,
  type Codespace,
  type Machine,
} from "../lib/codespaces";

const LS_PAT = "wenge_gh_pat";
const LS_REPO = "wenge_gh_repo";

export function CodespacesApp() {
  const [token, setToken] = useState(() => localStorage.getItem(LS_PAT) ?? "");
  const [saved, setSaved] = useState(() => !!localStorage.getItem(LS_PAT));
  const [repoInput, setRepoInput] = useState(() => localStorage.getItem(LS_REPO) ?? "");
  const [branch, setBranch] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machine, setMachine] = useState("");
  const [items, setItems] = useState<Codespace[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeToken = saved ? (localStorage.getItem(LS_PAT) ?? "") : "";

  const refresh = useCallback(async (t: string) => {
    if (!t) return;
    setBusy("list");
    setError("");
    try {
      setItems(await listCodespaces(t));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (activeToken) refresh(activeToken);
    const id = setInterval(() => {
      const t = localStorage.getItem(LS_PAT);
      if (t) refresh(t);
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [saved, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePat = () => {
    const t = token.trim();
    if (!t) return;
    localStorage.setItem(LS_PAT, t);
    setSaved(true);
    refresh(t);
  };
  const clearPat = () => {
    localStorage.removeItem(LS_PAT);
    setToken("");
    setSaved(false);
    setItems([]);
  };

  const fetchMachines = async () => {
    const p = parseRepo(repoInput);
    if (!p) { setError("owner/repo 形式で入力 (例 octocat/hello-world)"); return; }
    if (!activeToken) { setError("先にPATを保存"); return; }
    setBusy("machines");
    setError("");
    try {
      localStorage.setItem(LS_REPO, repoInput.trim());
      const ms = await listMachines(activeToken, p.owner, p.repo);
      setMachines(ms);
      if (ms.length > 0) setMachine(ms[0].name);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    const p = parseRepo(repoInput);
    if (!p) { setError("owner/repo 形式で入力"); return; }
    setBusy("create");
    setError("");
    try {
      await createCodespace(activeToken, p.owner, p.repo, { ref: branch.trim() || undefined, machine: machine || undefined });
      await refresh(activeToken);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const openCodespace = (c: Codespace) => {
    const url = c.web_url || `https://github.com/codespaces/${c.name}`;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      // ポップアップブロック時はURLを出して手動で開けるようにする
      prompt("ポップアップがブロックされました。このURLをコピーして開いてください:", url);
    }
  };

  const act = async (name: string, fn: (t: string, n: string) => Promise<unknown>) => {
    setBusy(name);
    setError("");
    try {
      await fn(activeToken, name);
      await refresh(activeToken);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", minHeight: 0 }}>
      <Fieldset label="GitHub PAT (localStorageのみ保存)">
        {saved ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
            <span>●●●● 保存済み (ブラウザ内のみ)</span>
            <Button size="sm" onClick={clearPat}>Clear</Button>
            <Button size="sm" onClick={() => refresh(activeToken)} disabled={busy === "list"}>
              {busy === "list" ? "..." : "Refresh"}
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="ghp_xxx" style={{ flex: 1 }} />
            <Button size="sm" onClick={savePat}>Save</Button>
          </div>
        )}
        <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>
          必要スコープ: <code>codespace</code> + <code>repo</code>。XSS漏洩リスクがあるため使い捨て Fine-grained 推奨。
        </div>
      </Fieldset>

      <Fieldset label="新規作成">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <TextInput value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="owner/repo" width={170} />
          <TextInput value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch(省略可)" width={120} />
          <Button size="sm" onClick={fetchMachines} disabled={busy === "machines"}>Machines</Button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <Select
              value={machine}
              onChange={(e: any) => setMachine(e.target?.value ?? "")}
              options={machines.length ? machines.map((m) => ({ value: m.name, label: m.display_name })) : [{ value: "", label: "(default machine)" }]}
              width="100%"
            />
          </div>
          <Button size="sm" onClick={create} disabled={busy === "create" || !saved}>
            {busy === "create" ? "..." : "Create"}
          </Button>
        </div>
      </Fieldset>

      {error && <div style={{ fontSize: 11, color: "#a00000", wordBreak: "break-all" }}>{error}</div>}

      <div style={{ border: "2px inset #fff", background: "#fff", flex: 1, minHeight: 120, overflow: "auto", padding: 6, fontSize: 11 }}>
        {items.length === 0 ? (
          <div style={{ color: "#888", textAlign: "center", marginTop: 30 }}>No codespaces. Save PAT to list.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #808080" }}>
                <th>Name</th><th>Repo</th><th>State</th><th>Ops</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.name} style={{ borderBottom: "1px dotted #c0c0c0" }}>
                  <td style={{ fontWeight: "bold" }}>{c.display_name || c.name}<br /><span style={{ fontWeight: "normal", color: "#666" }}>{c.machine?.display_name ?? ""} {c.git_status?.ref ? `(${c.git_status.ref})` : ""}</span></td>
                  <td>{c.repository?.full_name ?? "-"}</td>
                  <td>{c.state}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Button size="sm" title={c.web_url || `https://github.com/codespaces/${c.name}`} onClick={() => openCodespace(c)}>Open</Button>
                      <Button size="sm" disabled={busy === c.name} onClick={() => act(c.name, startCodespace)}>Start</Button>
                      <Button size="sm" disabled={busy === c.name} onClick={() => act(c.name, stopCodespace)}>Stop</Button>
                      <Button size="sm" disabled={busy === c.name} onClick={() => { if (confirm(`Delete ${c.name}?`)) act(c.name, deleteCodespace); }}>Del</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
