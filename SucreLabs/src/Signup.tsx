import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "./lib/api";
import Logo from "./Logo";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signup(name, email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-ink)] p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <Logo size={44} />

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-center mb-1">Create your workspace</h1>
            <p className="text-sm text-[var(--color-muted)] text-center">Your sessions stay private to your account</p>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <input
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg bg-[var(--color-panel-alt)] border border-[var(--color-border)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-teal)]"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg bg-[var(--color-panel-alt)] border border-[var(--color-border)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-teal)]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg bg-[var(--color-panel-alt)] border border-[var(--color-border)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-teal)]"
          />

          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[var(--color-teal)] text-[var(--color-ink)] px-6 py-2.5 text-sm font-medium disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {busy ? "Creating account…" : "Sign up"}
          </button>

          <p className="text-center text-sm text-[var(--color-muted)]">
            Already have an account?{" "}
            <Link to="/login" className="text-[var(--color-teal)] hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
