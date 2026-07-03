import mongoose from "mongoose";

const PersonaSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true },
  persona_id: { type: String, required: true }, // e.g. "optimist", "skeptic"
  role_label: { type: String, required: true },
  model: { type: String, required: true }, // model string used for this persona
  current_position: { type: [String], default: [] },
  belief_state: { type: String, default: "" },
  confidence_history: [
    {
      round: Number,
      score: Number,
      reason: String,
    },
  ],
  sources_seen: [
    {
      url: String,
      summary: String,
      interpretation: String,
    },
  ],
  updated_at: { type: Date, default: Date.now },
});

PersonaSchema.index({ session_id: 1, persona_id: 1 }, { unique: true });

export default mongoose.models.Persona ||
  mongoose.model("Persona", PersonaSchema);
