import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Menu, Sparkles } from "lucide-react";
import {
  fetchResearchProject,
  streamGenerateResearchProject,
  streamAssistantAction,
  downloadResearchExport,
  type ResearchProject,
  type ProjectSection,
} from "./lib/api";
import Logo from "./Logo";

const SECTION_ACTIONS = [
  { id: "expand", label: "Expand" },
  { id: "rewrite", label: "Rewrite" },
  { id: "simplify", label: "Simplify language" },
  { id: "make_academic", label: "Make more academic" },
  { id: "add_statistics", label: "Add statistics" },
  { id: "improve_flow", label: "Improve flow" },
  { id: "explain", label: "Explain simply" },
  { id: "proofread", label: "Proofread" },
  { id: "translate", label: "Translate" },
];

const DOCUMENT_ACTIONS = [
  { id: "summarize", label: "Summarize paper" },
  { id: "executive_summary", label: "Executive summary" },
  { id: "detect_weak_arguments", label: "Detect weak arguments" },
  { id: "generate_discussion_questions", label: "Discussion questions" },
  { id: "presentation_notes", label: "Presentation notes" },
  { id: "compare_viewpoints", label: "Compare viewpoints" },
  { id: "add_references", label: "Suggest more references" },
  { id: "suggest_sections", label: "Suggest new sections" },
];

function wordCount(sections: ProjectSection[]): number {
  return sections.reduce((sum, s) => sum + (s.content ? s.content.trim().split(/\s+/).length : 0), 0);
}

export default function ResearchLabPage() {
  const { project_id = "" } = useParams();
  const [project, setProject] = useState<ResearchProject | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const started = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const p = await fetchResearchProject(project_id);
      setProject(p);
      setNotice(p.research_notice);
      setActiveSectionId(p.sections[0]?.section_id || null);

      if (p.status === "draft" && !started.current) {
        started.current = true;
        runGeneration();
      }
    })();
  }, [project_id]);

  function updateSection(section_id: string, content: string) {
    setProject((prev) =>
      prev
        ? { ...prev, sections: prev.sections.map((s) => (s.section_id === section_id ? { ...s, content } : s)) }
        : prev
    );
  }

  async function runGeneration() {
    setGenerating(true);
    setStatusLog([]);
    try {
      await streamGenerateResearchProject(project_id, {
        onStatus: (text) => setStatusLog((prev) => [...prev, text]),
        onNotice: (text) => setNotice(text),
        onReferencesDone: (references) => setProject((prev) => (prev ? { ...prev, references } : prev)),
        onToken: (section_id, delta) => {
          if (!section_id) return;
          setProject((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              sections: prev.sections.map((s) =>
                s.section_id === section_id ? { ...s, content: s.content + delta } : s
              ),
            };
          });
        },
        onSectionDone: (section_id, content) => updateSection(section_id, content),
        onGenerationDone: () => {
          setStatusLog((prev) => [...prev, "Document ready."]);
          setProject((prev) => (prev ? { ...prev, status: "ready" } : prev));
        },
        onError: (message) => setStatusLog((prev) => [...prev, `Error: ${message}`]),
      });
    } finally {
      setGenerating(false);
    }
  }

  async function runAssistantAction(action: string, isSectionAction: boolean) {
    if (!project) return;
    const directive = isSectionAction ? instruction || undefined : instruction || undefined;
    setAssistantBusy(true);

    if (isSectionAction && activeSectionId) {
      updateSection(activeSectionId, "");
    }

    try {
      await streamAssistantAction(
        project_id,
        {
          action,
          section_id: isSectionAction ? activeSectionId || undefined : undefined,
          instruction: action === "custom" ? directive : undefined,
        },
        {
          onToken: (section_id, delta) => {
            if (section_id) {
              setProject((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  sections: prev.sections.map((s) =>
                    s.section_id === section_id ? { ...s, content: s.content + delta } : s
                  ),
                };
              });
            }
          },
          onSectionDone: (section_id, content) => updateSection(section_id, content),
          onDerivedDone: (type, content) => {
            setProject((prev) =>
              prev ? { ...prev, derived_outputs: [...prev.derived_outputs, { type, content }] } : prev
            );
          },
          onError: (message) => alert(message),
        }
      );
    } finally {
      setAssistantBusy(false);
      setInstruction("");
    }
  }

  if (!project) {
    return <div className="p-8 text-[var(--color-muted)]">Loading document…</div>;
  }

  const orderedSections = [...project.sections].sort((a, b) => a.order - b.order);
  const activeSection = orderedSections.find((s) => s.section_id === activeSectionId);
  const words = wordCount(project.sections);
  const suggestedImprovements = [...project.derived_outputs]
    .reverse()
    .find((d) => d.type === "suggested_improvements")?.content;
  const otherDerivedOutputs = project.derived_outputs.filter((d) => d.type !== "suggested_improvements");

  const AssistantPanelContent = (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto p-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">Suggested improvements</div>
          <button
            onClick={() => runAssistantAction("suggested_improvements", false)}
            disabled={assistantBusy}
            className="text-[10px] rounded-full border border-[var(--color-amber)] text-[var(--color-amber)] px-2 py-1 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
        {suggestedImprovements ? (
          <div className="text-sm whitespace-pre-wrap rounded-lg border border-[var(--color-border-alt)] bg-[var(--color-panel-alt)] p-3">
            {suggestedImprovements}
          </div>
        ) : (
          <div className="text-xs text-[var(--color-muted-alt)]">
            No suggestions yet -- click Refresh once the document is ready.
          </div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
          {activeSection ? `Editing: ${activeSection.title}` : "Select a section to edit"}
        </div>
        <div className="flex flex-wrap gap-2">
          {SECTION_ACTIONS.map((a) => (
            <button
              key={a.id}
              disabled={!activeSectionId || assistantBusy}
              onClick={() => runAssistantAction(a.id, true)}
              className="text-xs rounded-full border border-[var(--color-border-alt)] px-3 py-1.5 hover:bg-[var(--color-panel-alt)] disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">Whole document</div>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_ACTIONS.map((a) => (
            <button
              key={a.id}
              disabled={assistantBusy}
              onClick={() => runAssistantAction(a.id, false)}
              className="text-xs rounded-full border border-[var(--color-border-alt)] px-3 py-1.5 hover:bg-[var(--color-panel-alt)] disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={
            activeSectionId
              ? `Custom instruction for "${activeSection?.title}"…`
              : "Custom instruction for the whole document…"
          }
          rows={3}
          className="w-full rounded-lg bg-[var(--color-panel-alt)] border border-[var(--color-border)] p-3 text-sm outline-none focus:border-[var(--color-amber)]"
        />
        <button
          onClick={() => runAssistantAction("custom", !!activeSectionId)}
          disabled={!instruction.trim() || assistantBusy}
          className="self-end rounded-full bg-[var(--color-amber)] text-[var(--color-ink)] px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {assistantBusy ? "Working…" : "Send"}
        </button>
      </div>

      {otherDerivedOutputs.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">Generated notes</div>
          {[...otherDerivedOutputs].reverse().map((d, i) => (
            <div key={i} className="rounded-lg border border-[var(--color-border-alt)] bg-[var(--color-panel-alt)] p-3">
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-amber)] mb-1">
                {d.type.replace(/_/g, " ")}
              </div>
              <div className="text-sm whitespace-pre-wrap">{d.content}</div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--color-border)] pt-3">
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
          Source information ({project.references.length})
        </div>
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {project.references.length === 0 && (
            <div className="text-xs text-[var(--color-muted-alt)]">No references yet.</div>
          )}
          {project.references.map((r) => (
            <div key={r.id} className="text-xs text-[var(--color-paper)] leading-snug">
              {r.text}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-3">
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">Document stats</div>
        <div className="text-sm text-[var(--color-paper)]">{words} words · {project.references.length} references</div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-3 flex flex-col gap-2">
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">Export</div>
        <div className="flex gap-2 flex-wrap">
          {(["pdf", "docx", "md", "txt"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => downloadResearchExport(project_id, fmt, project.title || project.topic).catch((err) => alert(err.message))}
              className="text-xs rounded-full border border-[var(--color-border-alt)] px-3 py-1.5 hover:bg-[var(--color-panel-alt)]"
            >
              .{fmt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full relative">
      {/* Mobile outline drawer */}
      {outlineOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setOutlineOpen(false)} />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col p-4 gap-4 transition-transform duration-200 ${
          outlineOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <Logo size={26} glow={false} onClick={() => navigate("/")} />
        <div className="font-[family-name:var(--font-display)] text-lg text-[var(--color-muted)]">Outline</div>
        <div className="flex flex-col gap-1">
          {orderedSections.map((s) => (
            <button
              key={s.section_id}
              onClick={() => {
                setActiveSectionId(s.section_id);
                setOutlineOpen(false);
                document.getElementById(`section-${s.section_id}`)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`text-left text-sm px-2 py-1.5 rounded hover:bg-[var(--color-panel-alt)] ${
                activeSectionId === s.section_id ? "text-[var(--color-amber)]" : "text-[var(--color-paper)]"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </aside>

      {/* Main document */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--color-border)]">
          <button className="md:hidden text-[var(--color-paper)]" onClick={() => setOutlineOpen(true)} aria-label="Open outline">
            <Menu size={20} />
          </button>
          <span className="md:hidden">
            <Logo size={22} withWordmark={false} onClick={() => navigate("/")} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-lg truncate">{project.title}</h1>
            <p className="text-xs text-[var(--color-muted)]">
              {generating ? statusLog[statusLog.length - 1] || "Generating…" : `${words} words · ${project.model}`}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col gap-8 max-w-3xl mx-auto w-full">
          {notice && (
            <div className="rounded-lg border border-[var(--color-border-alt)] bg-[var(--color-panel-alt)] px-4 py-3 text-xs text-[var(--color-muted)]">
              {notice}
            </div>
          )}

          <div className="text-center">
            <h2 className="font-[family-name:var(--font-display)] text-3xl">{project.title}</h2>
          </div>

          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg mb-2">Table of Contents</h3>
            <ol className="text-sm text-[var(--color-muted)] list-decimal list-inside">
              {orderedSections.map((s) => (
                <li key={s.section_id}>
                  <button
                    onClick={() => {
                      setActiveSectionId(s.section_id);
                      document.getElementById(`section-${s.section_id}`)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="hover:text-[var(--color-amber)] hover:underline text-left"
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {orderedSections.map((s) => (
            <div key={s.section_id} id={`section-${s.section_id}`} onClick={() => setActiveSectionId(s.section_id)}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-[family-name:var(--font-display)] text-xl">{s.title}</h3>
                <button
                  onClick={() => {
                    setActiveSectionId(s.section_id);
                    setAssistantOpen(true);
                  }}
                  className="md:hidden text-xs text-[var(--color-amber)]"
                >
                  Edit
                </button>
              </div>
              <div
                className={`text-sm whitespace-pre-wrap leading-relaxed p-3 rounded-lg border transition-colors ${
                  activeSectionId === s.section_id
                    ? "border-[var(--color-amber)] bg-[var(--color-panel-alt)]"
                    : "border-transparent"
                }`}
              >
                {s.content || <span className="text-[var(--color-muted-alt)]">Not generated yet…</span>}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Desktop right sidebar: AI assistant */}
      <aside className="hidden md:flex w-80 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-panel)] flex-col">
        <div className="flex items-center gap-2 p-4 border-b border-[var(--color-border)]">
          <Sparkles size={16} color="var(--color-amber)" />
          <span className="font-[family-name:var(--font-display)] text-base">AI Research Assistant</span>
        </div>
        {AssistantPanelContent}
      </aside>

      {/* Mobile: floating assistant button + bottom sheet */}
      <button
        onClick={() => setAssistantOpen(true)}
        className="md:hidden fixed bottom-5 right-5 z-40 rounded-full bg-[var(--color-amber)] text-[var(--color-ink)] w-14 h-14 flex items-center justify-center shadow-lg hover:brightness-110 transition-all"
        aria-label="Open AI assistant"
      >
        <Sparkles size={22} />
      </button>
      {assistantOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAssistantOpen(false)} />
          <div className="relative w-full max-h-[85vh] bg-[var(--color-panel)] border-t border-[var(--color-border)] rounded-t-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <span className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg">
                <Sparkles size={16} color="var(--color-amber)" /> AI Research Assistant
              </span>
              <button onClick={() => setAssistantOpen(false)} className="text-[var(--color-muted)] text-sm">
                Close
              </button>
            </div>
            {AssistantPanelContent}
          </div>
        </div>
      )}
    </div>
  );
}
