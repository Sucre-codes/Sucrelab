// Document structure, in generation order. "references" is generated
// FIRST (even though it appears last in the document) so every later
// section can cite consistently from the same pool -- this is the one
// deliberate reordering between generation order and document order.
export const SECTION_DEFS = [
  { id: "abstract", title: "Abstract" },
  { id: "introduction", title: "Introduction" },
  { id: "background", title: "Background" },
  { id: "literature_review", title: "Literature Review" },
  { id: "methodology", title: "Methodology" },
  { id: "main_body", title: "Main Body" },
  { id: "analysis", title: "Analysis" },
  { id: "discussion", title: "Discussion" },
  { id: "conclusion", title: "Conclusion" },
  { id: "recommendations", title: "Recommendations" },
  { id: "references", title: "References" },
];

export const GENERATION_ORDER = [
  "references",
  "abstract",
  "introduction",
  "background",
  "literature_review",
  "methodology",
  "main_body",
  "analysis",
  "discussion",
  "conclusion",
  "recommendations",
];

export const DEFAULT_CONFIG = {
  academic_level: "Undergraduate",
  writing_style: "Academic",
  length: "Standard (2500-3500 words)",
  citation_style: "APA",
  language: "English",
  audience: "General academic",
  year_range: "last 10 years",
  num_references: 8,
};

// BTL has no live web-search endpoint -- this is the honest, spec-required
// fallback: internal knowledge only, clearly disclosed rather than implied.
export const RESEARCH_NOTICE =
  "Generated from the model's internal knowledge -- live web search was not available for this run, so very recent developments may not be reflected. Verify all references before citing them in submitted work.";

function configLine(config) {
  return `Academic level: ${config.academic_level}. Writing style: ${config.writing_style}. Target length: ${config.length}. Citation style: ${config.citation_style}. Language: ${config.language}. Audience: ${config.audience}. Prefer sources from: ${config.year_range}.`;
}

export function buildReferencesPrompt(topic, config) {
  return `You are an academic research assistant. Generate a reference list of approximately ${config.num_references} sources on the topic "${topic}", formatted strictly in ${config.citation_style} style, one per line. Prefer the kinds of sources a real literature review would cite: peer-reviewed journals, government publications, university research, standards organizations, and (for current topics) reputable news organizations. ${configLine(
    config
  )}\n\nOutput ONLY the formatted reference list, nothing else -- no heading, no commentary.`;
}

export function buildSectionPrompt({ sectionId, title, topic, config, referencesText }) {
  const base = `You are an academic research assistant writing the "${title}" section of a research document on "${topic}". ${configLine(
    config
  )}\n\nHere is the document's reference list -- cite from it in-text using ${config.citation_style} style where relevant:\n${referencesText}\n\nWrite ONLY the "${title}" section's content (no heading, no other sections, no meta-commentary about what you're doing).`;

  const perSection = {
    abstract: "Write a concise 150-250 word abstract summarizing the purpose, approach, and key takeaway of the paper.",
    introduction: "Introduce the topic, its significance, and what the document will cover.",
    background: "Provide the context and background a reader needs to understand the topic.",
    literature_review: "Summarize and synthesize existing research and key sources relevant to the topic, citing from the reference list.",
    methodology: "Describe the approach used to research and analyze the topic (this may be a literature synthesis rather than an empirical study -- describe it as such if so).",
    main_body: "Develop the core content and arguments of the paper in depth.",
    analysis: "Analyze the information presented, identifying patterns, tensions, or implications.",
    discussion: "Discuss the significance of the findings/analysis, including limitations and open questions.",
    conclusion: "Conclude the paper, tying back to the introduction and summarizing the key takeaway.",
    recommendations: "Give concrete, actionable recommendations based on the paper's analysis.",
  };

  return `${base}\n\n${perSection[sectionId] || ""}`;
}

// Actions that modify a single section's content in place.
export const SECTION_ACTIONS = {
  expand: "Expand this section with more depth and supporting detail, roughly doubling its length while staying factually consistent with the rest of the document.",
  rewrite: "Rewrite this section for clarity and flow while preserving its original meaning and citations.",
  simplify: "Simplify the technical language in this section so a general, non-specialist reader can follow it, without losing the core content.",
  make_academic: "Elevate this section's tone and phrasing to be more formally academic.",
  add_statistics: "Incorporate relevant statistics or data points into this section to strengthen its claims, noting they should be verified against real sources.",
  improve_flow: "Improve the logical flow and transitions within this section.",
  explain: "Rewrite this section as a plain-language explanation suitable for someone unfamiliar with the topic.",
  proofread: "Proofread this section: fix grammar, spelling, and clarity issues without changing its meaning or structure.",
  translate: "Translate this section into the document's configured language, preserving formatting and citations.",
};

// Actions that analyze/derive from the WHOLE document without editing any
// section -- these produce a new artifact shown in the assistant panel,
// per the spec's "modify only the requested sections... unless instructed
// otherwise" rule.
export const DOCUMENT_ACTIONS = {
  summarize: "Summarize the entire document in 200-300 words.",
  executive_summary: "Write a one-page executive summary of the document for a busy decision-maker audience.",
  detect_weak_arguments: "Identify any weak, unsupported, or overreaching arguments in the document, quoting the specific claim and explaining the weakness.",
  generate_discussion_questions: "Generate 5-8 thoughtful discussion questions based on the document, suitable for a seminar or study group.",
  presentation_notes: "Create concise speaker notes for presenting this document as a talk, organized by section.",
  compare_viewpoints: "Identify the main competing viewpoints relevant to this topic and compare them fairly, based on the document's content.",
  add_references: "Suggest 3-5 additional references (in the document's citation style) that would strengthen this document, and note where in the document each would best support a claim.",
  suggest_sections: "Suggest additional sections that would strengthen this document, with a one-sentence rationale for each.",
};
