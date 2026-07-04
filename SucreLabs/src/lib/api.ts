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

export const ALLOWED_MODELS = ["btl-2", "gpt-4.1-mini", "nova-lite-v1", "deepseek-v4-flash"] as const;
export type ModelId = (typeof ALLOWED_MODELS)[number];

export async function resolvePersonas(topic: string): Promise<{
  category: string;
  personas: { persona_id: string; role_label: string; color: string }[];
}> {
  const res = await fetch("/api/panel/personas", {
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
  const res = await fetch("/api/panel/round1", {
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
  const res = await fetch("/api/panel/round2", {
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
  const res = await fetch("/api/panel/followup", {
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
  const res = await fetch("/api/panel/round3", {
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
  const res = await fetch(`/api/panel/positions/${session_id}`);
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
  const res = await fetch("/api/research-lab/projects", {
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
  const res = await fetch("/api/research-lab/projects");
  if (!res.ok) throw new Error("Failed to list research projects");
  return res.json();
}

export async function fetchResearchProject(project_id: string): Promise<ResearchProject> {
  const res = await fetch(`/api/research-lab/projects/${project_id}`);
  if (!res.ok) throw new Error("Failed to load research project");
  return res.json();
}

export async function renameResearchProject(project_id: string, title: string): Promise<void> {
  await fetch(`/api/research-lab/projects/${project_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function archiveResearchProject(project_id: string, archived: boolean): Promise<void> {
  await fetch(`/api/research-lab/projects/${project_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: archived ? "archived" : "ready" }),
  });
}

export async function deleteResearchProject(project_id: string): Promise<void> {
  await fetch(`/api/research-lab/projects/${project_id}`, { method: "DELETE" });
}

export async function duplicateResearchProject(project_id: string): Promise<{ project_id: string }> {
  const res = await fetch(`/api/research-lab/projects/${project_id}/duplicate`, { method: "POST" });
  return res.json();
}

export function exportResearchProjectUrl(project_id: string, format: "pdf"|"md" | "txt" | "docx"): string {
  return `/api/research-lab/projects/${project_id}/export?format=${format}`;
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
  const res = await fetch(`/api/research-lab/projects/${project_id}/generate`, { method: "POST" });
  return consumeResearchLabSSE(res, handlers);
}

export async function streamAssistantAction(
  project_id: string,
  body: { action: string; section_id?: string; instruction?: string },
  handlers: ResearchLabHandlers
): Promise<void> {
  const res = await fetch(`/api/research-lab/projects/${project_id}/assistant`, {
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
  const res = await fetch("/api/chat/stream", {
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
