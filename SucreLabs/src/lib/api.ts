// Configurable API base for real hosting: in local dev this is empty and
// requests go through Vite's dev-server proxy (see vite.config.ts). In
// production, set VITE_API_BASE_URL at build time to the deployed backend's
// full URL (e.g. https://api.sucrelab.app) -- the frontend and backend
// don't need to share an origin once this is set.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const TOKEN_KEY = "sucrelab_token";
const USER_KEY = "sucrelab_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: { name: string; email: string }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): { name: string; email: string } | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Every request to our own API goes through this, so the Authorization
 * header and the hosted API_BASE are never something call sites need to
 * think about individually. A 401 means the token is missing/expired --
 * clear it and bounce to /login rather than showing a confusing failure.
 */
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    clearAuth();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  return res;
}

export type AuthUser = { name: string; email: string };

export async function signup(name: string, email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed");
  setAuth(data.token, data.user);
  return data.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  setAuth(data.token, data.user);
  return data.user;
}

export function logout() {
  clearAuth();
}

export function getSessionId(): string {
  const key = "sucrelab_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export type PersonaMeta = { persona_id: string; role_label: string; color: string; model?: string };

export type Round1Handlers = {
  onMeta?: (data: { category: string; personas: PersonaMeta[] }) => void;
  onToken?: (data: { persona_id: string; delta: string }) => void;
  onPersonaDone?: (data: { persona_id: string; fullText: string; confidence: number | null }) => void;
  onPersonaError?: (data: { persona_id: string; message: string }) => void;
  onRoundDone?: () => void;
  onError?: (message: string) => void;
};

export const ALLOWED_MODELS = ["gpt-4.1-mini","btl-2", "nova-lite-v1", "deepseek-v4-flash"] as const;
export type ModelId = (typeof ALLOWED_MODELS)[number];

export type PanelSessionSummary = {
  session_id: string;
  title: string;
  topic: string;
  category?: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export async function listPanelSessions(): Promise<{ sessions: PanelSessionSummary[] }> {
  const res = await apiFetch("/api/panel/sessions");
  if (!res.ok) throw new Error("Failed to list sessions");
  return res.json();
}

export async function renamePanelSession(session_id: string, title: string): Promise<void> {
  await apiFetch(`/api/panel/sessions/${session_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function archivePanelSession(session_id: string, archived: boolean): Promise<void> {
  await apiFetch(`/api/panel/sessions/${session_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived }),
  });
}

export async function deletePanelSession(session_id: string): Promise<void> {
  await apiFetch(`/api/panel/sessions/${session_id}`, { method: "DELETE" });
}

export async function duplicatePanelSession(session_id: string): Promise<{ session_id: string }> {
  const res = await apiFetch(`/api/panel/sessions/${session_id}/duplicate`, { method: "POST" });
  return res.json();
}

export async function resolvePersonas(topic: string): Promise<{
  category: string;
  personas: { persona_id: string; role_label: string; color: string }[];
}> {
  const res = await apiFetch("/api/panel/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error("Failed to resolve personas for this topic");
  return res.json();
}

export async function streamRound1(
  { session_id, topic, persona_models }: { session_id: string; topic: string; persona_models: Record<string, ModelId> },
  handlers: Round1Handlers
): Promise<void> {
  const res = await apiFetch("/api/panel/round1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic, persona_models }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "meta":
          handlers.onMeta?.(data);
          break;
        case "token":
          handlers.onToken?.(data);
          break;
        case "persona_done":
          handlers.onPersonaDone?.(data);
          break;
        case "persona_error":
          handlers.onPersonaError?.(data);
          break;
        case "round_done":
          handlers.onRoundDone?.();
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export type SimilarityMeta = { persona_id: string; conflicts_with: string | null; similarity: number };

export type Round2Handlers = {
  onMeta?: (data: { round: number; similarity_matrix: SimilarityMeta[] }) => void;
  onToken?: (data: { persona_id: string; delta: string }) => void;
  onPersonaDone?: (data: { persona_id: string; fullText: string; confidence: number | null }) => void;
  onPersonaError?: (data: { persona_id: string; message: string }) => void;
  onRoundDone?: () => void;
  onError?: (message: string) => void;
};

export async function streamRound2(
  { session_id, topic }: { session_id: string; topic: string },
  handlers: Round2Handlers
): Promise<void> {
  const res = await apiFetch("/api/panel/round2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "meta":
          handlers.onMeta?.(data);
          break;
        case "token":
          handlers.onToken?.(data);
          break;
        case "persona_done":
          handlers.onPersonaDone?.(data);
          break;
        case "persona_error":
          handlers.onPersonaError?.(data);
          break;
        case "round_done":
          handlers.onRoundDone?.();
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export type FollowupHandlers = {
  onMeta?: (data: { personas: PersonaMeta[] }) => void;
  onToken?: (data: { persona_id: string; delta: string }) => void;
  onPersonaDone?: (data: { persona_id: string; fullText: string; confidence: number | null }) => void;
  onPersonaError?: (data: { persona_id: string; message: string }) => void;
  onRoundDone?: () => void;
  onError?: (message: string) => void;
};

export async function streamFollowup(
  { session_id, topic, question }: { session_id: string; topic: string; question: string },
  handlers: FollowupHandlers
): Promise<void> {
  const res = await apiFetch("/api/panel/followup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic, question }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "meta":
          handlers.onMeta?.(data);
          break;
        case "token":
          handlers.onToken?.(data);
          break;
        case "persona_done":
          handlers.onPersonaDone?.(data);
          break;
        case "persona_error":
          handlers.onPersonaError?.(data);
          break;
        case "round_done":
          handlers.onRoundDone?.();
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export type Round3Handlers = {
  onMeta?: (data: { round: number; personas: PersonaMeta[] }) => void;
  onToken?: (data: { persona_id: string; delta: string }) => void;
  onPersonaDone?: (data: { persona_id: string; fullText: string; confidence: number | null }) => void;
  onPersonaError?: (data: { persona_id: string; message: string }) => void;
  onRoundDone?: () => void;
  onModeratorStart?: () => void;
  onModeratorDone?: (data: { fullText: string }) => void;
  onError?: (message: string) => void;
};

export async function streamRound3(
  { session_id, topic }: { session_id: string; topic: string },
  handlers: Round3Handlers
): Promise<void> {
  const res = await apiFetch("/api/panel/round3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "meta":
          handlers.onMeta?.(data);
          break;
        case "token":
          handlers.onToken?.(data);
          break;
        case "persona_done":
          handlers.onPersonaDone?.(data);
          break;
        case "persona_error":
          handlers.onPersonaError?.(data);
          break;
        case "round_done":
          handlers.onRoundDone?.();
          break;
        case "moderator_start":
          handlers.onModeratorStart?.();
          break;
        case "moderator_done":
          handlers.onModeratorDone?.(data);
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export type PositionsResponse = {
  topic: string;
  moderator_summary: string;
  personas: {
    persona_id: string;
    role_label: string;
    color: string;
    model: string;
    current_position: string[];
    confidence_history: { round: number; score: number | null; reason: string }[];
  }[];
};

export async function fetchPositions(session_id: string): Promise<PositionsResponse> {
  const res = await apiFetch(`/api/panel/positions/${session_id}`);
  if (!res.ok) throw new Error("Failed to load current positions");
  return res.json();
}

// ---------------------------------------------------------------------
// Research Lab: document-centric workspace, not a chat. Separate SSE
// vocabulary from the panel (status/notice/section_start/section_done vs
// meta/persona_done/round_done), so this gets its own small consumer.
// ---------------------------------------------------------------------

export type ResearchConfig = {
  academic_level: string;
  writing_style: string;
  length: string;
  citation_style: string;
  language: string;
  audience: string;
  year_range: string;
  num_references: number;
};

export const CONFIG_DEFAULTS: ResearchConfig = {
  academic_level: "Undergraduate",
  writing_style: "Academic",
  length: "Standard (2500-3500 words)",
  citation_style: "APA",
  language: "English",
  audience: "General academic",
  year_range: "last 10 years",
  num_references: 8,
};

export type ProjectSection = { section_id: string; title: string; content: string; order: number };
export type ProjectReference = { id: string; text: string };
export type DerivedOutput = { type: string; content: string; created_at?: string };
export type EditHistoryEntry = { timestamp: string; action: string; section_id: string | null; note: string };

export type ResearchProject = {
  project_id: string;
  topic: string;
  title: string;
  model: string;
  config: ResearchConfig;
  status: "draft" | "generating" | "ready" | "archived";
  research_notice: string;
  sections: ProjectSection[];
  references: ProjectReference[];
  derived_outputs: DerivedOutput[];
  edit_history: EditHistoryEntry[];
  updated_at: string;
  created_at: string;
};

export async function createResearchProject(
  topic: string,
  config: Partial<ResearchConfig>,
  model: ModelId
): Promise<{ project_id: string }> {
  const res = await apiFetch("/api/research-lab/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, config, model }),
  });
  if (!res.ok) throw new Error("Failed to create research project");
  return res.json();
}

export async function listResearchProjects(): Promise<{
  projects: { project_id: string; title: string; topic: string; status: string; updated_at: string }[];
}> {
  const res = await apiFetch("/api/research-lab/projects");
  if (!res.ok) throw new Error("Failed to list research projects");
  return res.json();
}

export async function fetchResearchProject(project_id: string): Promise<ResearchProject> {
  const res = await apiFetch(`/api/research-lab/projects/${project_id}`);
  if (!res.ok) throw new Error("Failed to load research project");
  return res.json();
}

export async function renameResearchProject(project_id: string, title: string): Promise<void> {
  await apiFetch(`/api/research-lab/projects/${project_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function archiveResearchProject(project_id: string, archived: boolean): Promise<void> {
  await apiFetch(`/api/research-lab/projects/${project_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: archived ? "archived" : "ready" }),
  });
}

export async function deleteResearchProject(project_id: string): Promise<void> {
  await apiFetch(`/api/research-lab/projects/${project_id}`, { method: "DELETE" });
}

export async function duplicateResearchProject(project_id: string): Promise<{ project_id: string }> {
  const res = await apiFetch(`/api/research-lab/projects/${project_id}/duplicate`, { method: "POST" });
  return res.json();
}

/**
 * Plain <a href> downloads can't carry the Authorization header, so this
 * fetches the export with auth, then triggers a save via a Blob URL.
 */
export async function downloadResearchExport(
  project_id: string,
  format: "md" | "txt" | "docx" | "pdf",
  filename: string
): Promise<void> {
  const res = await apiFetch(`/api/research-lab/projects/${project_id}/export?format=${format}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type ResearchLabHandlers = {
  onStatus?: (text: string) => void;
  onNotice?: (text: string) => void;
  onReferencesDone?: (references: ProjectReference[]) => void;
  onSectionStart?: (section_id: string) => void;
  onToken?: (section_id: string | null, delta: string) => void;
  onSectionDone?: (section_id: string, content: string) => void;
  onSectionError?: (section_id: string, message: string) => void;
  onDerivedDone?: (type: string, content: string) => void;
  onGenerationDone?: () => void;
  onError?: (message: string) => void;
};

async function consumeResearchLabSSE(res: Response, handlers: ResearchLabHandlers): Promise<void> {
  if (!res.body) throw new Error("No response body (streaming unsupported)");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "status":
          handlers.onStatus?.(data.text);
          break;
        case "notice":
          handlers.onNotice?.(data.text);
          break;
        case "references_done":
          handlers.onReferencesDone?.(data.references);
          break;
        case "section_start":
          handlers.onSectionStart?.(data.section_id);
          break;
        case "token":
          handlers.onToken?.(data.section_id, data.delta);
          break;
        case "section_done":
          handlers.onSectionDone?.(data.section_id, data.content);
          break;
        case "section_error":
          handlers.onSectionError?.(data.section_id, data.message);
          break;
        case "derived_done":
          handlers.onDerivedDone?.(data.type, data.content);
          break;
        case "generation_done":
          handlers.onGenerationDone?.();
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export async function streamGenerateResearchProject(
  project_id: string,
  handlers: ResearchLabHandlers
): Promise<void> {
  const res = await apiFetch(`/api/research-lab/projects/${project_id}/generate`, { method: "POST" });
  return consumeResearchLabSSE(res, handlers);
}

export async function streamAssistantAction(
  project_id: string,
  body: { action: string; section_id?: string; instruction?: string },
  handlers: ResearchLabHandlers
): Promise<void> {
  const res = await apiFetch(`/api/research-lab/projects/${project_id}/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return consumeResearchLabSSE(res, handlers);
}

export async function streamPersonaReply(
  { session_id, topic }: { session_id: string; topic: string },
  onToken: (delta: string) => void
): Promise<string> {
  const res = await apiFetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      if (event === "token") {
        full += data.delta;
        onToken(data.delta);
      } else if (event === "error") {
        throw new Error(data.message);
      }
    }
  }

  return full;
}
