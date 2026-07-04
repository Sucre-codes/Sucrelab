import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import chatRouter from "./routes/chat.js";
import panelRouter from "./routes/panel.js";
import researchLabRouter from "./routes/researchLab.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/chat", chatRouter);
app.use("/api/panel", panelRouter);
app.use("/api/research-lab", researchLabRouter);

const PORT = process.env.PORT || 8080;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to connect to Mongo:", err.message);
    process.exit(1);
  });
