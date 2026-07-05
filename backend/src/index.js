import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import { requireAuth } from "./lib/auth.js";
import authRouter from "./routes/auth.js";
import chatRouter from "./routes/chat.js";
import panelRouter from "./routes/panel.js";
import researchLabRouter from "./routes/researchLab.js";

const app = express();

// CORS_ORIGIN can be a comma-separated list of allowed origins for
// production (e.g. "https://sucrelab.app,https://www.sucrelab.app").
// Left unset, it reflects the request's origin -- fine for a hackathon
// deploy, but set it explicitly once you have a real domain.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigins }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/chat", requireAuth, chatRouter);
app.use("/api/panel", requireAuth, panelRouter);
app.use("/api/research-lab", requireAuth, researchLabRouter);

const PORT = process.env.PORT || 8080;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to connect to Mongo:", err.message);
    process.exit(1);
  });
