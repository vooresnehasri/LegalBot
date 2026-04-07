import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const GENERATED_DIR = path.join(DATA_DIR, "generated");

const FILES = {
  judgments: path.join(GENERATED_DIR, "judgments.json"),
  statutes: path.join(GENERATED_DIR, "statutes.json"),
  templates: path.join(GENERATED_DIR, "templates.json"),
  riskLabels: path.join(GENERATED_DIR, "risk_labels.json"),
  glossary: path.join(GENERATED_DIR, "glossary.json"),
  ontology: path.join(GENERATED_DIR, "ontology.json"),
  citationGraph: path.join(GENERATED_DIR, "citation_graph.json"),
  provenance: path.join(GENERATED_DIR, "provenance.json"),
  analysisHistory: path.join(DATA_DIR, "analysis_history.json"),
  feedback: path.join(DATA_DIR, "feedback_events.json"),
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "is",
  "are",
  "in",
  "on",
  "with",
  "under",
  "law",
  "legal",
  "case",
]);

function tokenize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

function overlapScore(queryTokens, text) {
  const textTokens = new Set(tokenize(text));
  let score = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) score += 1;
  }
  return score;
}

function normalizeCaseKey(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getAnalysisFromText(documentText) {
  const text = documentText.trim();
  const textLower = text.toLowerCase();

  const document_type = /(fir|complainant|accused|cognizable|police)/.test(textLower)
    ? "FIR"
    : /(agreement|party a|party b|hereby agree|terms)/.test(textLower)
    ? "Contract"
    : /(affidavit|deponent|solemnly affirm|verified)/.test(textLower)
    ? "Affidavit"
    : /(notice|hereby call upon|legal notice|demand)/.test(textLower)
    ? "Notice"
    : "General Legal Document";

  const category = /(ipc|crpc|arrest|bail|offence|criminal|fir)/.test(textLower)
    ? "criminal"
    : /(article 14|article 19|article 21|constitution|fundamental rights)/.test(textLower)
    ? "constitutional"
    : "civil";

  const predicted_sections = [];
  if (/(cheat|fraud|dishonest)/.test(textLower)) predicted_sections.push("IPC 420");
  if (/(breach of trust|entrustment)/.test(textLower)) predicted_sections.push("IPC 406");
  if (/(fir|cognizable)/.test(textLower)) predicted_sections.push("CrPC 154");
  if (/(anticipatory bail|apprehending arrest)/.test(textLower)) predicted_sections.push("CrPC 438");
  if (/(breach|damages|compensation)/.test(textLower)) predicted_sections.push("Contract Act 73");
  if (/(penalty|liquidated|forfeiture)/.test(textLower)) predicted_sections.push("Contract Act 74");
  if (/(privacy|personal liberty|life)/.test(textLower)) predicted_sections.push("Article 21");

  const riskSignals = [
    "immediate",
    "urgent",
    "loss",
    "penalty",
    "breach",
    "fraud",
    "criminal",
    "liability",
  ].filter((token) => textLower.includes(token)).length;

  const risk_level = riskSignals >= 4 ? "high" : riskSignals >= 2 ? "medium" : "low";

  return {
    document_type,
    category,
    predicted_sections: predicted_sections.length ? predicted_sections : ["Needs manual legal review"],
    risk_analysis: {
      risk_level,
      reason:
        risk_level === "high"
          ? "Multiple high-risk legal indicators detected; immediate legal review is recommended."
          : risk_level === "medium"
          ? "Some legal risk indicators detected; validate clauses and facts before action."
          : "No strong high-risk indicators detected, but legal review is still recommended.",
    },
    summary: text.length > 420 ? `${text.slice(0, 420)}...` : text || "No document text provided.",
  };
}

export async function loadDatasets() {
  const [
    judgments,
    statutes,
    templates,
    risk_labels,
    glossary,
    ontology,
    citation_graph,
    provenance,
    analysisHistory,
  ] = await Promise.all([
    readJson(FILES.judgments),
    readJson(FILES.statutes),
    readJson(FILES.templates),
    readJson(FILES.riskLabels),
    readJson(FILES.glossary),
    readJson(FILES.ontology),
    readJson(FILES.citationGraph),
    readJson(FILES.provenance),
    readJson(FILES.analysisHistory),
  ]);

  return {
    judgments,
    statutes,
    templates,
    risk_labels,
    glossary,
    ontology,
    citation_graph,
    provenance,
    analysisHistory,
  };
}

export function searchJudgments(judgments, query, category = "all", limit = 8) {
  const queryTokens = tokenize(query);
  const normalizedCategory = category.toLowerCase();
  const blockedCaseNames = new Set([
    "year",
    "archive_type",
    "file_count",
    "total_size",
    "total_size_human",
    "created_at",
    "updated_at",
    "parts",
  ]);

  const cleanedJudgments = judgments.filter((j) => {
    const caseName = String(j.case_name || "").trim().toLowerCase();
    if (!caseName || blockedCaseNames.has(caseName)) return false;
    return true;
  });

  const inferCategory = (judgment) => {
    const hay = [
      judgment.case_name,
      judgment.summary,
      judgment.citation,
      ...(judgment.tags || []),
      ...(judgment.key_sections || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/(ipc|crpc|fir|bail|offence|criminal|accused|police|arrest|drunk|driving)/.test(hay)) {
      return "criminal";
    }
    if (/(article\s*(14|19|21)|constitution|fundamental rights|writ|habeas)/.test(hay)) {
      return "constitutional";
    }
    if (/(contract|agreement|breach|damages|indemnity)/.test(hay)) {
      return "contract";
    }
    return "civil";
  };

  return cleanedJudgments
    .map((judgment) => {
      const effectiveCategory = (judgment.category || inferCategory(judgment) || "civil").toLowerCase();
      return { ...judgment, _effectiveCategory: effectiveCategory };
    })
    .filter((j) => (normalizedCategory === "all" ? true : j._effectiveCategory === normalizedCategory))
    .map((judgment) => {
      const haystack = [
        judgment.case_name,
        judgment.summary,
        judgment.citation,
        ...(judgment.tags || []),
        ...(judgment.key_sections || []),
      ].join(" ");
      return { judgment, score: overlapScore(queryTokens, haystack) };
    })
    .sort((a, b) => b.score - a.score || (b.judgment.year || 0) - (a.judgment.year || 0))
    .slice(0, limit)
    .map(({ judgment }) => ({
      case_name: judgment.case_name,
      citation: judgment.citation,
      court: typeof judgment.court === "string" ? judgment.court : "Unknown Court",
      year: Number(judgment.year) || 0,
      summary: judgment.summary,
      key_sections: judgment.key_sections || [],
      category: judgment._effectiveCategory || judgment.category || "civil",
      source_url: judgment.source_url,
    }));
}

export function searchLibraryRecords(datasets, query, category = "all", limit = 20) {
  const normalizedCategory = String(category || "all").toLowerCase();
  const queryText = query || "legal";
  const queryTokens = tokenize(queryText);
  const blockedCaseNames = new Set([
    "year",
    "archive_type",
    "file_count",
    "total_size",
    "total_size_human",
    "created_at",
    "updated_at",
    "parts",
  ]);

  const inferCategory = (text = "") => {
    const hay = String(text).toLowerCase();
    if (/(ipc|crpc|fir|bail|offence|criminal|accused|police|arrest|drunk|driving)/.test(hay)) {
      return "criminal";
    }
    if (/(article\s*(14|19|21)|constitution|fundamental rights|writ|habeas)/.test(hay)) {
      return "constitutional";
    }
    if (/(contract|agreement|breach|damages|indemnity)/.test(hay)) {
      return "contract";
    }
    return "civil";
  };

  const resolveCategory = (rawCategory, text) => {
    const normalized = String(rawCategory || "").toLowerCase().trim();
    const inferred = inferCategory(text);
    if (!normalized) return inferred;
    // Existing ingestion overused "civil"; allow stronger inferred category to override it.
    if (normalized === "civil" && inferred !== "civil") return inferred;
    return normalized;
  };

  const judgments = (datasets.judgments || [])
    .filter((j) => {
      const caseName = String(j.case_name || "").trim().toLowerCase();
      return caseName && !blockedCaseNames.has(caseName);
    })
    .map((j) => ({
      record_type: "judgment",
      case_name: j.case_name,
      citation: j.citation || "Unknown citation",
      court: typeof j.court === "string" ? j.court : "Unknown Court",
      year: Number(j.year) || 0,
      summary: j.summary || "Summary unavailable from source",
      key_sections: j.key_sections || [],
      category: resolveCategory(j.category, `${j.case_name} ${j.summary} ${j.citation}`),
      source_url: j.source_url || "",
      haystack: [j.case_name, j.summary, j.citation, ...(j.tags || []), ...(j.key_sections || [])].join(" "),
    }));

  const statutes = (datasets.statutes || []).map((s) => ({
    record_type: "statute",
    case_name: s.title || `${s.act_name} - Section ${s.section_no}`,
    citation: `${s.act_name || "Statute"} ${s.section_no ? `Section ${s.section_no}` : ""}`.trim(),
    court: "Statute",
    year: 0,
    summary: s.text || "Statute text unavailable",
    key_sections: [String(s.section_no || "")].filter(Boolean),
    category: resolveCategory(s.category, `${s.act_name} ${s.title} ${s.text}`),
    source_url: s.source_url || "",
    haystack: [s.act_name, s.title, s.text, s.section_no, ...(s.tags || [])].join(" "),
  }));

  const generatedDocs = (datasets.analysisHistory || []).map((a) => ({
    record_type: "generated_document",
    case_name: `${a.document_type || "Generated Document"} Record`,
    citation: a.id || "Generated analysis",
    court: "Internal",
    year: Number(String(a.created_at || "").slice(0, 4)) || 0,
    summary: a.summary || "Generated analysis record",
    key_sections: a.predicted_sections || [],
    category: resolveCategory(a.category, `${a.document_type} ${a.summary || ""}`),
    source_url: "",
    haystack: [a.document_type, a.summary, ...(a.predicted_sections || []), ...(a.issues_found || [])].join(" "),
  }));

  const templates = (datasets.templates || []).map((t) => ({
    record_type: "template",
    case_name: `${t.doc_type || "Template"} Template`,
    citation: t.id || "Template",
    court: "Template",
    year: 0,
    summary: `Required fields: ${(t.required_fields || []).join(", ") || "N/A"}`,
    key_sections: t.required_fields || [],
    category: resolveCategory("", `${t.doc_type} ${(t.required_fields || []).join(" ")}`),
    source_url: t.source_url || "",
    haystack: [t.doc_type, ...(t.required_fields || []), ...(t.clauses || [])].join(" "),
  }));

  return [...judgments, ...statutes, ...generatedDocs, ...templates]
    .filter((item) => (normalizedCategory === "all" ? true : item.category === normalizedCategory))
    .map((item) => ({
      ...item,
      score: overlapScore(queryTokens, item.haystack || ""),
    }))
    .filter((item) => item.score > 0 || !query?.trim())
    .sort((a, b) => b.score - a.score || (b.year || 0) - (a.year || 0))
    .slice(0, limit)
    .map(({ haystack, score, ...item }) => item);
}

export function retrieveLegalContext(statutes, judgments, query, limit = 6) {
  const queryTokens = tokenize(query);

  const statuteResults = statutes.map((s) => ({
    id: s.id,
    type: "statute",
    title: `${s.act_name} - Section ${s.section_no}`,
    snippet: s.text,
    source_url: s.source_url,
    score: overlapScore(queryTokens, [s.act_name, s.section_no, s.title, s.text, ...(s.tags || [])].join(" ")),
  }));

  const judgmentResults = judgments.map((j) => ({
    id: j.id,
    type: "judgment",
    title: `${j.case_name} (${j.citation})`,
    snippet: j.summary,
    source_url: j.source_url,
    score: overlapScore(queryTokens, [j.case_name, j.summary, j.citation, ...(j.tags || [])].join(" ")),
  }));

  return [...statuteResults, ...judgmentResults]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, idx) => ({ ...item, ref: `S${idx + 1}` }));
}

export function heuristicAnalyze(documentText) {
  return getAnalysisFromText(documentText);
}

export function expandQueryWithOntology(query = "", ontology = []) {
  if (!query?.trim() || !ontology.length) return query;
  const lower = query.toLowerCase();
  const expansions = new Set();

  for (const node of ontology) {
    const probe = [node.key, node.label, ...(node.aliases || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!probe) continue;
    if (
      lower.includes((node.key || "").toLowerCase()) ||
      lower.includes((node.label || "").toLowerCase()) ||
      (node.aliases || []).some((alias) => lower.includes(String(alias).toLowerCase()))
    ) {
      for (const alias of node.aliases || []) expansions.add(alias);
      if (node.label) expansions.add(node.label);
    }
  }

  if (!expansions.size) return query;
  return `${query} ${Array.from(expansions).join(" ")}`.trim();
}

export function suggestIssuesFromLabels(riskLabels = [], documentText = "") {
  const text = documentText.toLowerCase();
  return riskLabels
    .filter((r) => {
      const probe = `${r.text} ${(r.applicable_sections || []).join(" ")}`.toLowerCase();
      return probe.split(/\s+/).some((w) => w.length > 4 && text.includes(w));
    })
    .slice(0, 5)
    .map((r) => r.issues_found || [])
    .flat()
    .filter(Boolean);
}

export function applyGlossaryTerms(glossary = [], text = "", sourceLang = "English", targetLang = "Hindi") {
  if (!glossary.length || !text) return [];
  const isEnToHi =
    sourceLang.toLowerCase().startsWith("en") && targetLang.toLowerCase().startsWith("hi");
  if (!isEnToHi) return [];
  return glossary
    .filter((g) => text.toLowerCase().includes(g.term_en.toLowerCase()))
    .slice(0, 20)
    .map((g) => `${g.term_en} = ${g.term_hi}`);
}

export function enrichCasesWithCitationGraph(cases = [], citationGraph = []) {
  if (!cases.length || !citationGraph.length) return cases;

  const outgoing = new Map();
  const incomingCount = new Map();

  for (const edge of citationGraph) {
    const from = normalizeCaseKey(edge.from_case);
    const to = normalizeCaseKey(edge.to_case);
    if (!from || !to) continue;

    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push({
      to_case: edge.to_case,
      relation: edge.relation || "cites",
      source_url: edge.source_url || "",
    });

    incomingCount.set(to, (incomingCount.get(to) || 0) + 1);
  }

  return cases.map((item) => {
    const key = normalizeCaseKey(item.case_name);
    const cited_precedents = (outgoing.get(key) || []).slice(0, 5);
    return {
      ...item,
      citation_count: incomingCount.get(key) || 0,
      cited_precedents,
    };
  });
}

export async function storeAnalysisRecord(record) {
  const history = await readJson(FILES.analysisHistory, []);
  history.push({
    id: `analysis_${Date.now()}`,
    created_at: new Date().toISOString(),
    ...record,
  });
  await writeJson(FILES.analysisHistory, history);
}

export async function storeFeedbackEvent(event) {
  const history = await readJson(FILES.feedback, []);
  history.push({
    id: `feedback_${Date.now()}`,
    created_at: new Date().toISOString(),
    ...event,
  });
  await writeJson(FILES.feedback, history);
}

export async function getAnalyticsDocuments(userId) {
  const history = await readJson(FILES.analysisHistory, []);
  return history
    .filter((item) => item.user_id && (!userId || item.user_id === userId))
    .map((item) => ({
      id: item.id,
      user_id: item.user_id,
      created_at: item.created_at,
      document_type: item.document_type,
      category: item.category,
      predicted_sections: item.predicted_sections || [],
      risk_analysis: item.risk_analysis || { risk_level: "unknown", reason: "" },
      issues_found: item.issues_found || [],
      cited_sources: item.cited_sources || [],
      content: item.summary || "",
    }));
}
