import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true, unique: true },
  mode: { type: String, enum: ["panel", "research"], required: true },
  topic: { type: String, required: true },
  category: { type: String },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
