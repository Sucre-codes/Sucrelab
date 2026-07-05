import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema(
  {
    section_id: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    order: { type: Number, required: true },
    updated_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EditHistorySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    action: { type: String, required: true },
    section_id: { type: String, default: null },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const DerivedOutputSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. "summary", "executive_summary", "discussion_questions"
    content: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReferenceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const ResearchProjectSchema = new mongoose.Schema({
  project_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  topic: { type: String, required: true },
  title: { type: String, default: "" }, // editable display title, defaults to topic
  model: { type: String, required: true },
  config: {
    academic_level: { type: String, default: "Undergraduate" },
    writing_style: { type: String, default: "Academic" },
    length: { type: String, default: "Standard (2500-3500 words)" },
    citation_style: { type: String, default: "APA" },
    language: { type: String, default: "English" },
    audience: { type: String, default: "General academic" },
    year_range: { type: String, default: "last 10 years" },
    num_references: { type: Number, default: 8 },
  },
  status: {
    type: String,
    enum: ["draft", "generating", "ready", "archived"],
    default: "draft",
  },
  research_notice: { type: String, default: "" },
  sections: { type: [SectionSchema], default: [] },
  references: { type: [ReferenceSchema], default: [] },
  derived_outputs: { type: [DerivedOutputSchema], default: [] },
  edit_history: { type: [EditHistorySchema], default: [] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export default mongoose.models.ResearchProject ||
  mongoose.model("ResearchProject", ResearchProjectSchema);
