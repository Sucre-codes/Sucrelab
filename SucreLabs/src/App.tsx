import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessagesSquare, FileSearch, ArrowRight, Archive, Menu, X, LogOut } from "lucide-react";
import {
  getSessionId,
  resolvePersonas,
  createResearchProject,
  getStoredUser,
  logout,
  type ModelId,
  type ResearchConfig,
} from "./lib/api";
import ModelSelectModal, { type PersonaOption } from "./ModelSelectModal";
import ResearchLabSetupModal from "./ResearchLabSetupModal";
import RecentSessions from "./RecentSessions";
import Logo from "./Logo";

type Mode = "panel" | "research";

export default function App() {
  const [mode, setMode] = useState<Mode>("panel");
  const [topic, setTopic] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [modalPersonas, setModalPersonas] = useState<PersonaOption[]>([]);
  const [modalCategory, setModalCategory] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const navigate = useNavigate();
  const user = getStoredUser();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleSubmit() {
    if (!topic.trim() || resolving) return;
    getSessionId();

    if (mode === "research") {
      setModalOpen(true);
      return;
    }

    setResolving(true);
    try {
      const { category, personas } = await resolvePersonas(topic);
      setModalCategory(category);
      setModalPersonas(personas);
      setModalOpen(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setResolving(false);
    }
  }

  function handlePanelModelsConfirmed(models: Record<string, ModelId>) {
    const sessionId = crypto.randomUUID();
    setModalOpen(false);
    navigate(
      `/panel/${sessionId}?topic=${encodeURIComponent(topic)}&models=${encodeURIComponent(JSON.stringify(models))}`
    );
  }

  async function handleResearchConfigConfirmed(config: ResearchConfig, model: ModelId) {
    setCreatingProject(true);
    try {
      const { project_id } = await createResearchProject(topic, config, model);
      setModalOpen(false);
      navigate(`/research-lab/${project_id}`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreatingProject(false);
    }
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between">
        <Logo size={34} />
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden text-[var(--color-muted)] hover:text-[var(--color-paper)]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">Recent</span>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
            showArchived
              ? "border-[var(--color-amber)] text-[var(--color-amber)]"
              : "border-[var(--color-border-alt)] text-[var(--color-muted)]"
          }`}
        >
          <Archive size={11} /> Archived
        </button>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        <RecentSessions showArchived={showArchived} />
      </div>

      {user && (
        <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border)]">
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate text-[var(--color-paper)]">{user.name}</div>
            <div className="text-[10px] truncate text-[var(--color-muted-alt)]">{user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="text-[var(--color-muted)] hover:text-red-400 p-1.5"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full relative bg-[var(--color-ink)]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col gap-4 p-4 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 md:hidden border-b border-[var(--color-border)]">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--color-paper)]" aria-label="Open sidebar">
            <Menu size={20} />
          </button>
          <Logo size={26} />
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start md:justify-center pt-10 px-6 pb-8 sm:p-10 relative">
          {/* Signature ambient glow behind the hero, echoing the logo's lit bulb */}
          <div
            className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full blur-[100px] opacity-25"
            style={{ background: "radial-gradient(circle, var(--color-teal) 0%, transparent 70%)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-1/3 left-[60%] w-[360px] h-[360px] rounded-full blur-[100px] opacity-15"
            style={{ background: "radial-gradient(circle, var(--color-amber) 0%, transparent 70%)" }}
            aria-hidden
          />

          <div className="relative w-full max-w-2xl flex flex-col items-center gap-8 animate-rise-in">
            <div className="text-center flex flex-col gap-3">
              <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-amber)]">AI Workspace</span>
              <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl leading-tight">
                Bring the hard question.
                <br />
                Leave with a sharper answer.
              </h1>
              <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto">
                Put it to a live panel of AI experts, or turn it into a fully sourced research document!! 
                same workspace, either direction.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <button
                onClick={() => setMode("panel")}
                className={`text-left rounded-xl border p-4 transition-all ${
                  mode === "panel"
                    ? "border-[var(--color-teal)] bg-[var(--color-panel-alt)] shadow-[0_0_0_1px_var(--color-teal)]"
                    : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-alt)]"
                }`}
              >
                <MessagesSquare size={20} color="var(--color-teal)" />
                <div className="mt-2 font-medium text-sm">Debate this</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">
                  A panel of expert personas argues it out, round by round.
                </div>
              </button>

              <button
                onClick={() => setMode("research")}
                className={`text-left rounded-xl border p-4 transition-all ${
                  mode === "research"
                    ? "border-[var(--color-amber)] bg-[var(--color-panel-alt)] shadow-[0_0_0_1px_var(--color-amber)]"
                    : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-alt)]"
                }`}
              >
                <FileSearch size={20} color="var(--color-amber)" />
                <div className="mt-2 font-medium text-sm">Research this</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">
                  A cited, structured document you can edit, expand, and export.
                </div>
              </button>
            </div>

            <div className="w-full flex flex-col gap-3">
              <div className="relative">
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={
                    mode === "panel"
                      ? "e.g. Should we raise our Series A now or wait 6 months?"
                      : "e.g. Artificial Intelligence in Healthcare"
                  }
                  rows={3}
                  className="w-full rounded-xl bg-[var(--color-panel-alt)] border border-[var(--color-border)] p-4 pr-4 text-[var(--color-paper)] placeholder:text-[var(--color-muted-alt)] outline-none focus:border-[var(--color-teal)] transition-colors resize-none"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={resolving || !topic.trim()}
                className="self-end flex items-center gap-2 rounded-full bg-[var(--color-teal)] text-[var(--color-ink)] px-6 py-2.5 text-sm font-medium disabled:opacity-40 hover:brightness-110 transition-all"
              >
                {resolving ? "Finding your panel…" : mode === "panel" ? "Open the panel" : "Set up document"}
                {!resolving && <ArrowRight size={15} />}
              </button>
            </div>
          </div>
        </div>
      </main>

      <ModelSelectModal
        open={modalOpen && mode === "panel"}
        topic={topic}
        category={modalCategory}
        personas={modalPersonas}
        onConfirm={handlePanelModelsConfirmed}
        onCancel={() => setModalOpen(false)}
      />

      <ResearchLabSetupModal
        open={modalOpen && mode === "research"}
        topic={topic}
        onConfirm={(config, model) => {
          if (!creatingProject) handleResearchConfigConfirmed(config, model);
        }}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
