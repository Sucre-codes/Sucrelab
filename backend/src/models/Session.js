import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true, unique: true },
  mode: { type: String, enum: ["panel", "research"], required: true },
  user_id: { type: String, required: true, index: true },
  topic: { type: String, required: true },
  category: { type: String },
  title: { type: String, default: "" }, // editable display title, defaults to topic
  archived: { type: Boolean, default: false },
  moderator_summary: { type: String, default: "" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
