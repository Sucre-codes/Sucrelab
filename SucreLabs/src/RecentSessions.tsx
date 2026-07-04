import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessagesSquare, FileText, Pencil, Copy, Archive, ArchiveRestore, Trash2, Check, X } from "lucide-react";
import {
  listPanelSessions,
  renamePanelSession,
  archivePanelSession,
  deletePanelSession,
  duplicatePanelSession,
  listResearchProjects,
  renameResearchProject,
  archiveResearchProject,
  deleteResearchProject,
  duplicateResearchProject,
} from "./lib/api";
import { relativeTime } from "./lib/time";

type Item = {
  id: string;
  kind: "panel" | "research";
  title: string;
  archived: boolean;
  updated_at: string;
  status?: string;
};

export default function RecentSessions({ showArchived = false }: { showArchived?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const [panels, projects] = await Promise.all([listPanelSessions(), listResearchProjects()]);
      const merged: Item[] = [
        ...panels.sessions.map((s) => ({
          id: s.session_id,
          kind: "panel" as const,
          title: s.title || s.topic,
          archived: s.archived,
          updated_at: s.updated_at,
        })),
        ...projects.projects.map((p) => ({
          id: p.project_id,
          kind: "research" as const,
          title: p.title || p.topic,
          archived: p.status === "archived",
          updated_at: p.updated_at,
          status: p.status,
        })),
      ]
        .filter((i) => showArchived || !i.archived)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setItems(merged);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [showArchived]);

  function open(item: Item) {
    if (item.kind === "panel") navigate(`/panel/${item.id}`);
    else navigate(`/research-lab/${item.id}`);
  }

  function startRename(item: Item) {
    setEditingId(item.id);
    setEditingTitle(item.title);
  }

  async function confirmRename(item: Item) {
    const title = editingTitle.trim();
    setEditingId(null);
    if (!title || title === item.title) return;
    if (item.kind === "panel") await renamePanelSession(item.id, title);
    else await renameResearchProject(item.id, title);
    load();
  }

  async function toggleArchive(item: Item) {
    if (item.kind === "panel") await archivePanelSession(item.id, !item.archived);
    else await archiveResearchProject(item.id, !item.archived);
    load();
  }

  async function duplicate(item: Item) {
    if (item.kind === "panel") {
      const { session_id } = await duplicatePanelSession(item.id);
      navigate(`/panel/${session_id}`);
    } else {
      const { project_id } = await duplicateResearchProject(item.id);
      navigate(`/research-lab/${project_id}`);
    }
  }

  async function remove(item: Item) {
    if (!confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    if (item.kind === "panel") await deletePanelSession(item.id);
    else await deleteResearchProject(item.id);
    load();
  }

  if (loading) {
    return <div className="text-xs text-[var(--color-muted-alt)] px-1">Loading sessions…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-xs text-[var(--color-muted-alt)] px-1">
        {showArchived ? "No archived sessions." : "Nothing yet — start a debate or a research doc above."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div
          key={`${item.kind}-${item.id}`}
          className="group relative flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[var(--color-panel-alt)] transition-colors"
        >
          <span
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md"
            style={{
              backgroundColor:
                item.kind === "panel" ? "color-mix(in srgb, var(--color-teal) 20%, transparent)" : "color-mix(in srgb, var(--color-amber) 20%, transparent)",
              color: item.kind === "panel" ? "var(--color-teal)" : "var(--color-amber)",
            }}
          >
            {item.kind === "panel" ? <MessagesSquare size={14} /> : <FileText size={14} />}
          </span>

          {editingId === item.id ? (
            <div className="flex-1 flex items-center gap-1 min-w-0">
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename(item);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 min-w-0 bg-[var(--color-ink)] border border-[var(--color-teal)] rounded px-1.5 py-0.5 text-sm outline-none"
              />
              <button onClick={() => confirmRename(item)} className="text-[var(--color-teal)] shrink-0">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingId(null)} className="text-[var(--color-muted)] shrink-0">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => open(item)} className="flex-1 min-w-0 text-left">
              <div className="text-sm truncate text-[var(--color-paper)]">{item.title}</div>
              <div className="text-[10px] text-[var(--color-muted-alt)]">{relativeTime(item.updated_at)}</div>
            </button>
          )}

          {editingId !== item.id && (
            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
              <button onClick={() => startRename(item)} title="Rename" className="text-[var(--color-muted)] hover:text-[var(--color-paper)] p-1">
                <Pencil size={13} />
              </button>
              <button onClick={() => duplicate(item)} title="Duplicate" className="text-[var(--color-muted)] hover:text-[var(--color-paper)] p-1">
                <Copy size={13} />
              </button>
              <button onClick={() => toggleArchive(item)} title={item.archived ? "Unarchive" : "Archive"} className="text-[var(--color-muted)] hover:text-[var(--color-paper)] p-1">
                {item.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              </button>
              <button onClick={() => remove(item)} title="Delete" className="text-[var(--color-muted)] hover:text-red-400 p-1">
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
