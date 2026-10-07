const API = "https://api.github.com";

export type Codespace = {
  name: string;
  display_name?: string | null;
  state: string;
  repository?: { full_name?: string } | null;
  git_status?: { ref?: string } | null;
  machine?: { display_name?: string; name?: string } | null;
  web_url?: string;
  last_used_at?: string;
  created_at?: string;
};

export type Machine = { name: string; display_name: string };

export type CodespacePort = {
  port: number;
  protocol: string;
  visibility: string;
  port_url: string;
  name?: string | null;
  state?: string;
};

export type CodespaceWithPorts = Codespace & { ports: CodespacePort[]; };

async function gh(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.message || JSON.stringify(j).slice(0, 200);
    } catch {
      detail = await res.text().catch(() => "");
    }
    const hint =
      res.status === 401
        ? "PATが無効・期限切れの可能性"
        : res.status === 403 || res.status === 404
          ? "スコープ不足 (codespace + repo) の可能性"
          : res.status === 402
            ? "Codespaces利用上限・課金制限の可能性"
            : "";
    throw new Error(`GitHub ${res.status}: ${detail} ${hint}`.trim());
  }
  if (res.status === 204) return null;
  return res.json();
}

export const listCodespaces = (token: string) =>
  gh(token, "/user/codespaces?per_page=50").then((d) => (d?.codespaces ?? []) as Codespace[]);

export const listMachines = (token: string, owner: string, repo: string) =>
  gh(token, `/repos/${owner}/${repo}/codespaces/machines`).then(
    (d) => ((d?.machines ?? []) as Machine[]).map((m) => ({ name: m.name, display_name: m.display_name })),
  );

export const createCodespace = (token: string, owner: string, repo: string, opts: { ref?: string; machine?: string }) =>
  gh(token, `/repos/${owner}/${repo}/codespaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: opts.ref || undefined, machine: opts.machine || undefined }),
  }) as Promise<Codespace>;

export const startCodespace = (token: string, name: string) =>
  gh(token, `/user/codespaces/${encodeURIComponent(name)}/start`, { method: "POST" });

export const stopCodespace = (token: string, name: string) =>
  gh(token, `/user/codespaces/${encodeURIComponent(name)}/stop`, { method: "POST" });

export const deleteCodespace = (token: string, name: string) =>
  gh(token, `/user/codespaces/${encodeURIComponent(name)}`, { method: "DELETE" });

// Get exposed ports for a codespace (requires repo context: owner/repo)
export const listCodespacePorts = (
  token: string,
  owner: string,
  repo: string,
  name: string,
): Promise<{ ports: CodespacePort[] }> =>
  gh(
    token,
    `/repos/${owner}/${repo}/codespaces/${encodeURIComponent(name)}/ports`,
  );

// Resolve owner/repo for a codespace using its repository.full_name, fallback to web_url
export const repoFromCodespace = (c: Codespace): { owner: string; repo: string } | null => {
  if (c.repository?.full_name) {
    const m = c.repository.full_name.split("/");
    if (m.length >= 2) return { owner: m[0], repo: m[1] };
  }
  if (c.web_url) {
    // https://github.com/owner/repo ...-codespaces -{uuid}
    const u = new URL(c.web_url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "codespaces") return null; // web_url for codespace is like .../codespaces/<name>
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
  }
  return null;
};

export const parseRepo = (s: string): { owner: string; repo: string } | null => {
  const m = s.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
};
