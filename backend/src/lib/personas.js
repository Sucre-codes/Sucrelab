// Full persona roster. Category auto-selection picks exactly 3 of these
// per session — see selectPersonas() below.

// Models the BTL runtime supports. The user picks one per persona in the
// UI before a round starts -- there is no server-side default model
// anymore (previously env-based, now always explicit per persona).
export const ALLOWED_MODELS = [ "gpt-4.1-mini", "btl-2","nova-lite-v1", "deepseek-v4-flash"];
export const FALLBACK_MODEL = "gpt-4.1-mini";
export const MODERATOR_MODEL = "gpt-4o-mini";
export function sanitizeModel(model) {
     if (!ALLOWED_MODELS.includes(model)) {
    console.log(`Model "${model}" not in ALLOWED_MODELS, falling back to ${FALLBACK_MODEL}`);
  }
  return ALLOWED_MODELS.includes(model) ? model : FALLBACK_MODEL;
 
}

export const ROSTER = {
  optimist: {
    role_label: "Optimist", 
    color: "teal",
    system: `You are the Optimist on a decision panel. You genuinely believe in upside and possibility, but you're not naive — you argue for the best realistic case, grounded in specifics, not generic positivity.`,
  },
  skeptic: {
    role_label: "Skeptic",
    color: "amber",
    system: `You are the Skeptic on a decision panel. You stress-test claims, surface hidden risks and failure modes, and push back on assumptions — but you argue in good faith, not just for the sake of disagreeing.`,
  },
  pragmatist: {
    role_label: "Pragmatist",
    color: "muted",
    system: `You are the Pragmatist on a decision panel. You care about what's actually executable given real constraints (time, money, people). You weigh tradeoffs concretely rather than arguing in the abstract.`,
  },
  investor: {
    role_label: "Investor",
    color: "amber",
    system: `You are the Investor on a decision panel. You think in terms of capital efficiency, return, risk-adjusted upside, and opportunity cost. You ask what this decision does to valuation, runway, and future fundability.`,
  },
  lawyer: {
    role_label: "Lawyer",
    color: "muted",
    system: `You are the Lawyer on a decision panel. You think about liability, compliance, contractual exposure, and downside protection. You are not there to kill the deal, but to make sure risk is priced in.`,
  },
  engineer: {
    role_label: "Engineer",
    color: "teal",
    system: `You are the Engineer on a decision panel. You think about feasibility, technical debt, maintainability, and what breaks at scale. You ground opinions in how systems actually behave.`,
  },
  economist: {
    role_label: "Economist",
    color: "amber",
    system: `You are the Economist on a decision panel. You think in incentives, market dynamics, second-order effects, and macro conditions. You look past the immediate decision to what it sets in motion.`,
  },
  pm: {
    role_label: "PM",
    color: "teal",
    system: `You are the Product Manager on a decision panel. You think about user value, prioritization, and what tradeoff this decision forces elsewhere on the roadmap.`,
  },
  doctor: {
    role_label: "Doctor",
    color: "teal",
    system: `You are the Doctor on a decision panel. You think about health outcomes, evidence quality, and risk to wellbeing. You are precise about what is and isn't clinically supported.`,
  },
  teacher: {
    role_label: "Teacher",
    color: "muted",
    system: `You are the Teacher on a decision panel. You think about how people actually learn and change behavior, and what this decision does to real understanding versus surface compliance.`,
  },
};

// Keyword -> category rules, checked in order. First match wins.
// Each category maps to exactly 3 persona_ids from the roster above.
const CATEGORY_RULES = [
  {
    category: "startup_business",
    keywords: ["startup", "funding", "series a", "vc", "raise", "valuation", "runway", "cofounder", "equity", "pitch"],
    personas: ["investor", "pragmatist", "skeptic"],
  },
  {
    category: "legal_policy",
    keywords: ["contract", "lawsuit", "liability", "compliance", "regulation", "legal", "policy", "law"],
    personas: ["lawyer", "pragmatist", "skeptic"],
  },
  {
    category: "engineering_tech",
    keywords: ["architecture", "database", "migrate", "refactor", "framework", "scale", "infrastructure", "api", "code", "software"],
    personas: ["engineer", "pragmatist", "skeptic"],
  },
  {
    category: "economics_finance",
    keywords: ["market", "inflation", "economy", "tariff", "interest rate", "investment", "stock", "trade"],
    personas: ["economist", "investor", "skeptic"],
  },
  {
    category: "product",
    keywords: ["feature", "roadmap", "user", "product", "launch", "ux", "onboarding"],
    personas: ["pm", "engineer", "skeptic"],
  },
  {
    category: "health",
    keywords: ["health", "medical", "diet", "treatment", "symptom", "doctor", "diagnosis"],
    personas: ["doctor", "pragmatist", "optimist"],
  },
  {
    category: "education",
    keywords: ["school", "curriculum", "teach", "student", "learning", "education"],
    personas: ["teacher", "pragmatist", "skeptic"],
  },
];

const DEFAULT_CATEGORY = "general";
const DEFAULT_PERSONAS = ["optimist", "skeptic", "pragmatist"];

export function selectPersonas(topic) {
  const lower = topic.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { category: rule.category, personaIds: rule.personas };
    }
  }
  return { category: DEFAULT_CATEGORY, personaIds: DEFAULT_PERSONAS };
}
