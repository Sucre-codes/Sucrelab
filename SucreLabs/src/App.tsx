import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSessionId, resolvePersonas, type ModelId } from "./lib/api";
import ModelSelectModal, { type PersonaOption } from "./ModelSelectModal";

type Mode = "panel" | "research";

export default function App() {
  const [mode, setMode] = useState<Mode>("panel");
  const [topic, setTopic] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [modalPersonas, setModalPersonas] = useState<PersonaOption[]>([]);
  const [modalCategory, setModalCategory] = useState("");
  const navigate = useNavigate();

  async function handleSubmit() {
    if (!topic.trim() || resolving) return;
    getSessionId();

    if (mode === "research") {
      // Research Studio lands in the 24-38h build window -- model selection
      // will apply there too once it's wired, per the same picker pattern.
      alert("Research Studio is next up in the build order -- not wired yet.");
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

  function handleModelsConfirmed(models: Record<string, ModelId>) {
    const sessionId = crypto.randomUUID();
    setModalOpen(false);
    navigate(
      `/panel/${sessionId}?topic=${encodeURIComponent(topic)}&models=${encodeURIComponent(
        JSON.stringify(models)
      )}`
    );
  }

  return (
    <div className="flex h-full relative">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col p-4 gap-6 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="font-[family-name:var(--font-display)] text-xl tracking-wide">
          SucreLab
        </div>
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
          Think Better. Research Deeper. Decide Smarter.
        </div>
        <div className="flex-1" />
        <div className="text-xs text-[var(--color-muted-alt)]">
          Recent sessions coming soon
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 p-4 md:hidden border-b border-[var(--color-border)]">
          <button
            className="text-[var(--color-paper)]"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <span className="font-[family-name:var(--font-display)] text-lg">SucreLab</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 gap-6">
          <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl text-center max-w-xl">
            What are you trying to think through?
          </h1>

          <div className="flex rounded-full border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setMode("panel")}
              className={`px-5 py-2 text-sm ${
                mode === "panel"
                  ? "bg-[var(--color-teal)] text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Debate this
            </button>
            <button
              onClick={() => setMode("research")}
              className={`px-5 py-2 text-sm ${
                mode === "research"
                  ? "bg-[var(--color-amber)] text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              Research this
            </button>
          </div>

          <div className="w-full max-w-2xl flex flex-col gap-3">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Should we raise our Series A now or wait 6 months?"
              rows={3}
              className="w-full rounded-lg bg-[var(--color-panel-alt)] border border-[var(--color-border)] p-4 text-[var(--color-paper)] placeholder:text-[var(--color-muted-alt)] outline-none focus:border-[var(--color-teal)]"
            />
            <button
              onClick={handleSubmit}
              disabled={resolving}
              className="self-end rounded-full bg-[var(--color-teal)] text-[var(--color-ink)] px-6 py-2 text-sm font-medium disabled:opacity-50"
            >
              {resolving ? "Finding your panel…" : mode === "panel" ? "Open the panel" : "Start research"}
            </button>
          </div>
        </div>
      </main>

      <ModelSelectModal
        open={modalOpen}
        topic={topic}
        category={modalCategory}
        personas={modalPersonas}
        onConfirm={handleModelsConfirmed}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
