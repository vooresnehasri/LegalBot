import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  loadDatasets,
  searchJudgments,
  searchLibraryRecords,
  retrieveLegalContext,
  heuristicAnalyze,
  suggestIssuesFromLabels,
  applyGlossaryTerms,
  expandQueryWithOntology,
  enrichCasesWithCitationGraph,
  storeAnalysisRecord,
  storeFeedbackEvent,
  getAnalyticsDocuments,
} from "./lib/data-service.js";
import {
  ensureAuthStorage,
  registerLawyer,
  loginUser,
  getSessionUser,
  destroySession,
  submitLawyerVerification,
  getPendingVerifications,
  reviewVerification,
} from "./lib/auth-service.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

console.log("API KEY Loaded:", Boolean(process.env.GEMINI_API_KEY));

await ensureAuthStorage();

function getBearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

async function requireAuth(req, res, next) {
  const user = await getSessionUser(getBearerToken(req));
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.authUser = user;
  next();
}

async function requireAdmin(req, res, next) {
  const user = await getSessionUser(getBearerToken(req));
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  req.authUser = user;
  next();
}

async function requireApprovedLawyer(req, res, next) {
  const user = await getSessionUser(getBearerToken(req));
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "lawyer") {
    return res.status(403).json({ error: "Lawyer account required" });
  }
  if (!user.is_verified_lawyer || user.verification_status !== "approved") {
    return res.status(403).json({
      error: "Lawyer verification pending",
      verification_status: user.verification_status,
    });
  }
  req.authUser = user;
  next();
}

function getProviderChain() {
  const raw = (process.env.LLM_PROVIDER_CHAIN || process.env.LLM_PROVIDER || "groq,gemini")
    .toLowerCase()
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return raw.length ? raw : ["groq", "gemini"];
}

async function callGemini(message) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key missing");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Gemini request failed");
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGroq(message) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Groq API key missing");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: message }],
      temperature: 0.2,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Groq request failed");
  return data?.choices?.[0]?.message?.content || "";
}

async function callLlm(message) {
  const providers = getProviderChain();
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === "groq") return await callGroq(message);
      if (provider === "gemini") return await callGemini(message);
      errors.push(`${provider}: unsupported provider`);
    } catch (error) {
      errors.push(`${provider}: ${error?.message || "request failed"}`);
    }
  }

  throw new Error(`All LLM providers failed. ${errors.join(" | ")}`);
}

function extractJsonObject(text = "") {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function fallbackGuideTurn(documentType, history) {
  const safeHistory = Array.isArray(history) ? history : [];
  if (!safeHistory.length) {
    return {
      ready: false,
      next_question: "Please describe your issue in plain language.",
      draft_details: "",
      missing_points: ["Facts", "Parties", "Timeline", "Relief sought"],
    };
  }

  const lastAnswer = String(safeHistory[safeHistory.length - 1]?.answer || "").trim();
  if (lastAnswer.length < 20) {
    return {
      ready: false,
      next_question: "Can you provide more detail, including dates, people involved, and what outcome you want?",
      draft_details: "",
      missing_points: ["Detailed facts", "Date/time", "Parties", "Relief sought"],
    };
  }

  const historyText = safeHistory
    .map((item, idx) => `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`)
    .join("\n\n");

  return {
    ready: safeHistory.length >= 4,
    next_question:
      safeHistory.length >= 4
        ? ""
        : "What legal outcome do you want (for example, complaint registration, payment recovery, injunction, or specific relief)?",
    draft_details: safeHistory.length >= 4
      ? `Title: ${documentType || "Legal Draft"}\n\nParties:\n- (Fill from answers)\n\nFacts:\n${historyText}\n\nDates/Timeline:\n- (Extract key dates from answers)\n\nLocation:\n- (Specify location)\n\nLegal Basis:\n- (To be finalized after legal review)\n\nRelief/Prayer:\n- (State the exact relief sought)\n\nSupporting Material:\n- (List documents/evidence)`
      : "",
    missing_points:
      safeHistory.length >= 4
        ? []
        : ["Relief sought", "Key dates", "Supporting documents"],
  };
}

async function ensureIngestedData(req, res, next) {
  const datasets = await loadDatasets();
  req.datasets = datasets;

  if (!datasets.judgments.length && !datasets.statutes.length) {
    return res.status(503).json({
      error: "No ingested official/open datasets found. Run backend ingestion pipeline first.",
      hint: "cd backend && npm run ingest:apply",
    });
  }

  next();
}

function buildContextBlock(context) {
  if (!context?.length) {
    return "No direct dataset context matched. Provide a cautious response and advise manual legal verification.";
  }
  return context
    .map((c) => `[${c.ref}] ${c.title}\n${c.snippet}\nSource: ${c.source_url}`)
    .join("\n\n");
}

const DOC_CONTEXT_PROFILES = {
  fir: {
    include: [
      "fir",
      "criminal",
      "motor vehicles",
      "section 185",
      "drunk",
      "driving",
      "traffic",
      "ipc",
      "crpc 154",
      "rash",
      "negligent",
    ],
    exclude: [
      "contract",
      "commercial",
      "arbitration",
      "damages",
      "section 438",
      "anticipatory bail",
    ],
  },
  contract: {
    include: ["contract", "agreement", "section 73", "section 74", "consideration", "breach"],
    exclude: ["fir", "criminal", "section 154", "motor vehicles"],
  },
  affidavit: {
    include: ["affidavit", "verification", "deponent", "sworn"],
    exclude: ["commercial arbitration"],
  },
  notice: {
    include: ["notice", "demand", "legal notice", "relief"],
    exclude: ["anticipatory bail"],
  },
};

function docProfileForType(documentType = "") {
  const key = normalizeDraftType(documentType);
  if (!key) return null;
  if (DOC_CONTEXT_PROFILES[key]) return DOC_CONTEXT_PROFILES[key];
  if (key.includes("fir")) return DOC_CONTEXT_PROFILES.fir;
  if (key.includes("contract") || key.includes("agreement")) return DOC_CONTEXT_PROFILES.contract;
  if (key.includes("affidavit")) return DOC_CONTEXT_PROFILES.affidavit;
  if (key.includes("notice")) return DOC_CONTEXT_PROFILES.notice;
  return null;
}

function refineContextForDocument(context = [], documentType = "", details = "", limit = 6) {
  if (!Array.isArray(context) || context.length === 0) return [];
  const profile = docProfileForType(documentType);
  if (!profile) return context.slice(0, limit);

  const queryText = `${documentType} ${details}`.toLowerCase();
  const ranked = context.map((item, idx) => {
    const hay = `${item.title || ""} ${item.snippet || ""}`.toLowerCase();
    let score = Math.max(1, 20 - idx);

    for (const token of profile.include || []) {
      if (hay.includes(token) || queryText.includes(token)) score += 5;
    }
    for (const token of profile.exclude || []) {
      if (hay.includes(token)) score -= 6;
    }

    if (documentType.toLowerCase().includes("fir")) {
      if ((item.type || "") === "statute") score += 2;
      if (hay.includes("motor vehicles")) score += 4;
      if (hay.includes("section 185")) score += 5;
    }

    return { ...item, _rankScore: score };
  });

  const filtered = ranked.filter((x) => x._rankScore > 0);
  const pool = filtered.length ? filtered : ranked;
  return pool
    .sort((a, b) => b._rankScore - a._rankScore)
    .slice(0, limit)
    .map(({ _rankScore, ...rest }, i) => ({ ...rest, ref: `S${i + 1}` }));
}

const LEGAL_DRAFTING_SECTIONS = {
  fir: [
    "Title",
    "Complainant Details",
    "Accused Details",
    "Facts of Incident",
    "Applicable Legal Provisions",
    "Prayer",
  ],
  affidavit: [
    "Title",
    "Deponent Details",
    "Statement of Facts",
    "Verification",
  ],
  contract: [
    "Title",
    "Parties",
    "Definitions",
    "Terms and Conditions",
    "Obligations",
    "Payment Terms",
    "Termination",
    "Dispute Resolution",
    "Signatures",
  ],
  notice: [
    "Title",
    "Sender Details",
    "Recipient Details",
    "Facts",
    "Legal Basis",
    "Demand and Timeline",
    "Signature",
  ],
  legal_notice: [
    "Title",
    "Sender Details",
    "Recipient Details",
    "Facts",
    "Legal Basis",
    "Demand and Timeline",
    "Signature",
  ],
  lease_agreement: [
    "Title",
    "Parties",
    "Property Details",
    "Term",
    "Rent and Deposit",
    "Obligations",
    "Termination",
    "Dispute Resolution",
    "Signatures",
  ],
  sale_deed: [
    "Title",
    "Parties",
    "Property Description",
    "Consideration",
    "Representations and Warranties",
    "Possession and Transfer",
    "Signatures",
  ],
  will: [
    "Title",
    "Testator Details",
    "Declaration",
    "Bequests",
    "Executor",
    "Witnesses",
    "Signatures",
  ],
  default: [
    "Title",
    "Parties",
    "Facts",
    "Legal Basis",
    "Relief/Terms",
    "Signature",
  ],
};

function normalizeDraftType(type = "") {
  return String(type || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function requiredSectionsForDraft(documentType) {
  const key = normalizeDraftType(documentType);
  return LEGAL_DRAFTING_SECTIONS[key] || LEGAL_DRAFTING_SECTIONS.default;
}

function missingSections(documentText, requiredSections) {
  const lower = String(documentText || "").toLowerCase();
  return requiredSections.filter((section) => {
    const token = section.toLowerCase();
    return !lower.includes(token);
  });
}

app.get("/health", async (_req, res) => {
  const datasets = await loadDatasets();
  const chain = getProviderChain();
  res.json({
    ok: true,
    model: chain[0] === "groq" ? (process.env.GROQ_MODEL || "llama-3.3-70b-versatile") : "gemini-2.0-flash-001",
    llm_provider_chain: chain,
    mode: "official_open_only",
    counts: {
      judgments: datasets.judgments.length,
      statutes: datasets.statutes.length,
      templates: datasets.templates.length,
      risk_labels: datasets.risk_labels.length,
      glossary: datasets.glossary.length,
      ontology: datasets.ontology.length,
      citation_graph: datasets.citation_graph.length,
      provenance_entries: datasets.provenance.length,
    },
  });
});

app.post("/auth/signup", async (req, res) => {
  try {
    const user = await registerLawyer(req.body || {});
    res.status(201).json({
      user,
      message: "Account created. Please log in and complete lawyer verification.",
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Signup failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { token, user } = await loginUser({
      emailOrPhone: req.body?.emailOrPhone,
      password: req.body?.password,
    });
    res.json({ token, user });
  } catch (error) {
    res.status(401).json({ error: error.message || "Login failed" });
  }
});

app.post("/auth/logout", requireAuth, async (req, res) => {
  await destroySession(getBearerToken(req));
  res.json({ ok: true });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.authUser });
});

app.post("/auth/verify-lawyer", requireAuth, async (req, res) => {
  try {
    const verification = await submitLawyerVerification(req.authUser.id, req.body || {});
    const user = await getSessionUser(getBearerToken(req));
    res.json({ verification, user });
  } catch (error) {
    res.status(400).json({ error: error.message || "Verification submission failed" });
  }
});

app.get("/admin/verifications", requireAdmin, async (_req, res) => {
  try {
    const records = await getPendingVerifications();
    res.json({ verifications: records });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch verification requests" });
  }
});

app.post("/admin/verifications/:id/review", requireAdmin, async (req, res) => {
  try {
    const result = await reviewVerification(
      req.params.id,
      req.authUser.id,
      req.body?.action,
      req.body?.rejection_reason
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Review failed" });
  }
});

app.get("/templates", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  res.json({ templates: req.datasets.templates || [] });
});

app.get("/cases", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  try {
    const query = (req.query.query || "").toString().trim();
    const category = (req.query.category || "all").toString();
    const recordType = (req.query.record_type || "all").toString().toLowerCase();
    const debugEnabled = String(req.query.debug || "").toLowerCase() === "1";

    const allRecords = searchLibraryRecords(
      req.datasets,
      query,
      "all",
      500
    );

    const availableCategories = Array.from(
      new Set(allRecords.map((r) => String(r.category || "unknown").toLowerCase()))
    ).sort();
    const availableRecordTypes = Array.from(
      new Set(allRecords.map((r) => String(r.record_type || "unknown").toLowerCase()))
    ).sort();

    let records = allRecords.filter((r) =>
      category === "all" ? true : String(r.category || "").toLowerCase() === category.toLowerCase()
    );
    records = records.filter((r) => (recordType === "all" ? true : String(r.record_type || "").toLowerCase() === recordType));
    records = records.slice(0, 80);

    const judgmentsOnly = records.filter((r) => r.record_type === "judgment");
    const enrichedJudgments = enrichCasesWithCitationGraph(judgmentsOnly, req.datasets.citation_graph);
    const judgmentMap = new Map(
      enrichedJudgments.map((j) => [`${j.case_name}|${j.citation}`, j])
    );

    const merged = records.map((item) => {
      if (item.record_type !== "judgment") return item;
      return judgmentMap.get(`${item.case_name}|${item.citation}`) || item;
    });

    const payload = {
      cases: merged,
      available_categories: ["all", ...availableCategories],
      available_record_types: ["all", ...availableRecordTypes],
      total_matches: allRecords.length,
    };

    if (debugEnabled) {
      payload.debug = {
        query,
        category,
        record_type: recordType,
        all_records_count: allRecords.length,
        returned_count: merged.length,
        available_categories: payload.available_categories,
        available_record_types: payload.available_record_types,
      };
      console.log("/cases debug:", payload.debug);
    }

    res.json(payload);
  } catch (error) {
    console.error("/cases error:", error);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

app.post("/analyze", requireApprovedLawyer, async (req, res) => {
  try {
    const documentText = (req.body.documentText || "").toString();
    if (!documentText.trim()) return res.status(400).json({ error: "documentText required" });

    const datasets = await loadDatasets();
    const expandedQuery = expandQueryWithOntology(documentText, datasets.ontology);
    const context = retrieveLegalContext(
      datasets.statutes,
      datasets.judgments,
      expandedQuery,
      5
    );
    let analysis = heuristicAnalyze(documentText);

    if (process.env.GEMINI_API_KEY) {
      const contextBlock = buildContextBlock(context);
      const prompt = `
You are an Indian legal document analyzer.
Refine the JSON below while keeping the same keys and valid JSON only.

Input JSON:
${JSON.stringify(analysis, null, 2)}

Document:
${documentText.slice(0, 6000)}

Legal Context:
${contextBlock}

Return ONLY valid JSON with keys:
{
  "document_type": "",
  "category": "",
  "predicted_sections": [],
  "risk_analysis": { "risk_level": "", "reason": "" },
  "summary": ""
}
`;

      const reply = await callLlm(prompt);
      const jsonMatch = reply?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch {
          // Keep deterministic fallback.
        }
      }
    }

    const enriched = {
      ...analysis,
      user_id: req.authUser.id,
      cited_sources: context,
      issues_found: suggestIssuesFromLabels(datasets.risk_labels, documentText),
      ontology_matches: datasets.ontology
        .filter((node) =>
          [node.key, node.label, ...(node.aliases || [])]
            .filter(Boolean)
            .some((term) => documentText.toLowerCase().includes(String(term).toLowerCase()))
        )
        .map((node) => node.label || node.key)
        .slice(0, 8),
    };

    await storeAnalysisRecord(enriched);
    res.json(enriched);
  } catch (error) {
    console.error("/analyze error:", error);
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

app.get("/analytics", requireApprovedLawyer, async (req, res) => {
  try {
    const documents = await getAnalyticsDocuments(req.authUser.id);
    res.json({ documents });
  } catch (error) {
    console.error("/analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.post("/generate-document", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  try {
    const mode = (req.body.mode || "official_forms").toString();
    const documentType = (req.body.documentType || "").toString().trim();
    const formData = req.body.formData || {};
    const supportingDocuments = Array.isArray(req.body.supportingDocuments)
      ? req.body.supportingDocuments
      : [];
    if (!documentType) {
      return res.status(400).json({ error: "documentType required" });
    }

    const details = Object.entries(formData)
      .map(([k, v]) => `${k}: ${String(v || "")}`)
      .join("\n");
    const supportingEvidenceBlock = supportingDocuments.length
      ? supportingDocuments
          .map((doc, idx) => {
            const proofType = String(doc.proof_type || "Supporting Document");
            const name = String(doc.name || `Document ${idx + 1}`);
            const description = String(doc.description || "").trim();
            const extractedText = String(doc.extracted_text || "").trim().slice(0, 4000);
            return [
              `Document ${idx + 1}: ${name}`,
              `Proof Type: ${proofType}`,
              description ? `User Note: ${description}` : "",
              extractedText ? `Extracted Text:\n${extractedText}` : "Extracted Text: Not available",
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n")
      : "No supporting documents provided.";

    const template = (req.datasets.templates || []).find(
      (t) => (t.doc_type || "").toLowerCase() === documentType.toLowerCase()
    );

    const initialContext = retrieveLegalContext(
      req.datasets.statutes,
      req.datasets.judgments,
      `${documentType}\n${details}`,
      18
    );
    const context = refineContextForDocument(initialContext, documentType, details, 6);
    const contextBlock = buildContextBlock(context);
    const requiredSections = requiredSectionsForDraft(documentType);
    const templateGuidance = template
      ? JSON.stringify(template, null, 2)
      : "No official form template matched.";

    const prompt = mode === "legal_drafting" ? `
You are a professional Indian legal drafting assistant.
Draft a complete ${documentType} in strict legal-document format.

Template Guidance:
${templateGuidance}

User Details:
${details}

Supporting Documents:
${supportingEvidenceBlock}

Grounding Context:
${contextBlock}

Requirements:
- court-ready formatting
- clear headings and party details
- legally coherent structure
- include placeholders only if critical details are missing
- when documents support a fact, incorporate it carefully
- if useful, mention annexures/supporting documents in the draft
- include ALL of these section headings exactly:
${requiredSections.map((s) => `- ${s}`).join("\n")}
` : `
You are a professional Indian legal drafting assistant.
Draft a complete ${documentType} using formal legal language.

Template Guidance:
${templateGuidance}

User Details:
${details}

Supporting Documents:
${supportingEvidenceBlock}

Grounding Context:
${contextBlock}

Requirements:
- court-ready formatting
- clear headings and party details
- legally coherent structure
- include placeholders only if critical details are missing
- when documents support a fact, incorporate it carefully
- if useful, mention annexures/supporting documents in the draft
`;

    let reply = await callLlm(prompt);
    if (mode === "legal_drafting" && reply) {
      const missing = missingSections(reply, requiredSections);
      if (missing.length) {
        const repairPrompt = `
You drafted a legal document but some required headings are missing.
Rewrite the document in complete, court-ready format.

Document Type:
${documentType}

Original Draft:
${reply.slice(0, 12000)}

Missing Required Headings:
${missing.map((s) => `- ${s}`).join("\n")}

Return a complete corrected draft with all required headings.
`;
        const repaired = await callLlm(repairPrompt);
        if (repaired) reply = repaired;
      }
    }

    if (!reply) {
      return res.status(503).json({ error: "LLM unavailable for document generation" });
    }

    res.json({
      document: reply,
      sources: context,
      supporting_documents_used: supportingDocuments.length,
      template_used: template?.id || null,
      mode,
      required_sections: mode === "legal_drafting" ? requiredSections : [],
    });
  } catch (error) {
    console.error("/generate-document error:", error);
    res.status(500).json({ error: "Failed to generate document" });
  }
});

app.post("/suggest-document-type", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  try {
    const issueText = (req.body.issueText || "").toString().trim();
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const historyText = history
      .map((item, idx) => {
        const q = String(item?.question || "").trim();
        const a = String(item?.answer || "").trim();
        return q && a ? `Q${idx + 1}: ${q}\nA${idx + 1}: ${a}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    if (!issueText) {
      return res.status(400).json({ error: "issueText required" });
    }

    const initialContext = retrieveLegalContext(
      req.datasets.statutes,
      req.datasets.judgments,
      `${issueText}\n${historyText}`,
      10
    );
    const contextBlock = buildContextBlock(initialContext.slice(0, 4));

    const prompt = `
You are an Indian legal intake assistant.
Infer the best legal document type from the user's issue description.

Rules:
- Do not use a fixed predefined list.
- Choose a practical drafting document type label.
- Provide one primary suggestion and up to 3 alternatives.
- Keep labels short and professional.
- Base the result on user facts; do not invent facts.

Issue:
${issueText}

Conversation History:
${historyText || "No prior Q/A."}

Legal Context:
${contextBlock}

Return ONLY valid JSON:
{
  "primary_type": "",
  "alternatives": [],
  "reasoning": "",
  "confidence": 0.0
}
`;

    let parsed = null;
    let reply = "";
    try {
      reply = await callLlm(prompt);
      parsed = extractJsonObject(reply);
    } catch (error) {
      console.warn("/suggest-document-type LLM unavailable:", error?.message || error);
    }

    if (!parsed || typeof parsed !== "object") {
      const repairPrompt = `
Convert the following model output into valid JSON with keys:
{
  "primary_type": "",
  "alternatives": [],
  "reasoning": "",
  "confidence": 0.0
}
If unclear, choose a reasonable legal drafting type.

Output:
${String(reply || "").slice(0, 4000)}
`;
      try {
        parsed = extractJsonObject(await callLlm(repairPrompt));
      } catch (error) {
        console.warn("/suggest-document-type repair failed:", error?.message || error);
      }
    }

    if (!parsed || typeof parsed !== "object") {
      return res.json({
        primary_type: "Legal Draft",
        alternatives: ["Legal Notice", "Complaint"],
        reasoning: "Used fallback suggestion because model output was unavailable or invalid.",
        confidence: 0.2,
      });
    }

    const primary = String(parsed.primary_type || "").trim();
    const alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives.map((x) => String(x).trim()).filter(Boolean).slice(0, 3)
      : [];
    if (!primary) {
      return res.json({
        primary_type: "Legal Draft",
        alternatives: ["Legal Notice", "Complaint"],
        reasoning: "Used fallback suggestion because model returned an empty type.",
        confidence: 0.2,
      });
    }

    res.json({
      primary_type: primary,
      alternatives,
      reasoning: String(parsed.reasoning || "").trim(),
      confidence: Number(parsed.confidence || 0),
    });
  } catch (error) {
    console.error("/suggest-document-type error:", error);
    res.status(500).json({ error: "Failed to suggest document type" });
  }
});

app.post("/drafting-guide-turn", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  try {
    const mode = (req.body.mode || "legal_drafting").toString();
    if (mode !== "legal_drafting") {
      return res.status(400).json({ error: "Guided drafting is only available for legal_drafting mode" });
    }

    const documentType = (req.body.documentType || "").toString().trim();
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const sanitizedHistory = history
      .map((item) => ({
        question: String(item?.question || "").trim(),
        answer: String(item?.answer || "").trim(),
      }))
      .filter((item) => item.question && item.answer)
      .slice(-12);

    const historyText = sanitizedHistory
      .map((item, idx) => `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`)
      .join("\n\n");

    const contextQuery = [
      documentType,
      ...sanitizedHistory.map((item) => item.answer),
    ].join("\n");
    const initialContext = retrieveLegalContext(
      req.datasets.statutes,
      req.datasets.judgments,
      contextQuery || "legal drafting",
      15
    );
    const context = refineContextForDocument(initialContext, documentType || "legal drafting", historyText, 5);
    const contextBlock = buildContextBlock(context);

    const prompt = `
You are a legal intake assistant for Indian legal drafting.
Your job is to ask one best next follow-up question based on the user's previous answers.

Rules:
- Do NOT ask multiple questions at once.
- Keep the question simple, non-legal-jargon, and specific.
- Follow up on missing critical details only.
- If enough information is available, set ready=true.
- Never hallucinate facts; use only the user conversation.

Conversation History:
${historyText || "No history yet."}

Document Type Preference:
${documentType || "Not specified"}

Legal Context (for relevance, not for inventing facts):
${contextBlock}

Return ONLY valid JSON:
{
  "ready": false,
  "next_question": "",
  "draft_details": "",
  "missing_points": []
}

If ready=true:
- next_question must be ""
- draft_details must be a structured brief with clear headings:
  Title, Parties, Facts, Dates/Timeline, Location, Legal Basis, Relief/Prayer, Supporting Material
- missing_points should include any still-missing critical items as short strings.
`;

    let reply = "";
    try {
      reply = (await callLlm(prompt)) || "";
    } catch (error) {
      // Quota/rate-limit/network: continue with deterministic fallback.
      console.warn("/drafting-guide-turn LLM unavailable, using fallback:", error?.message || error);
    }
    const parsed = extractJsonObject(reply);
    const base = parsed && typeof parsed === "object"
      ? parsed
      : fallbackGuideTurn(documentType, sanitizedHistory);
    const ready = Boolean(base.ready) || sanitizedHistory.length >= 8;
    const result = {
      ready,
      next_question: ready ? "" : String(base.next_question || "Can you share the most important missing detail?"),
      draft_details: String(base.draft_details || ""),
      missing_points: Array.isArray(base.missing_points)
        ? base.missing_points.map((x) => String(x)).slice(0, 8)
        : [],
      sources: context,
    };

    if (ready && !result.draft_details.trim()) {
      const fallbackPrompt = `
Create a structured drafting brief from this legal intake history.

History:
${historyText}

Document Type:
${documentType || "General Legal Draft"}

Return plain text with headings:
Title
Parties
Facts
Dates/Timeline
Location
Legal Basis
Relief/Prayer
Supporting Material
`;
      try {
        result.draft_details = (await callLlm(fallbackPrompt)) || result.draft_details;
      } catch (error) {
        console.warn("/drafting-guide-turn fallback drafting brief LLM unavailable:", error?.message || error);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("/drafting-guide-turn error:", error);
    res.status(500).json({ error: "Failed to run guided drafting turn" });
  }
});

app.post("/summarize", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  try {
    const documentText = (req.body.documentText || "").toString();
    if (!documentText.trim()) {
      return res.status(400).json({ error: "documentText required" });
    }

    const expandedQuery = expandQueryWithOntology(documentText, req.datasets.ontology);
    const context = retrieveLegalContext(
      req.datasets.statutes,
      req.datasets.judgments,
      expandedQuery,
      6
    );
    const contextBlock = buildContextBlock(context);

    const prompt = `
You are an expert legal document analyst for Indian law.
Summarize the document in this structure:
1. Brief Overview
2. Key Points (bullet points)
3. Legal Principles Involved
4. Final Outcome / Conclusion

Document:
${documentText.slice(0, 9000)}

Grounding Context:
${contextBlock}

Use source markers [S1], [S2] where relevant.
`;

    const reply = await callLlm(prompt);
    if (!reply) {
      return res.status(503).json({ error: "LLM unavailable for summarization" });
    }

    res.json({ summary: reply, sources: context });
  } catch (error) {
    console.error("/summarize error:", error);
    res.status(500).json({ error: "Failed to summarize document" });
  }
});

app.post("/translate", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  try {
    const sourceText = (req.body.sourceText || "").toString();
    const sourceLang = (req.body.sourceLang || "English").toString();
    const targetLang = (req.body.targetLang || "Hindi").toString();
    if (!sourceText.trim()) {
      return res.status(400).json({ error: "sourceText required" });
    }

    const expandedQuery = expandQueryWithOntology(sourceText, req.datasets.ontology);
    const context = retrieveLegalContext(
      req.datasets.statutes,
      req.datasets.judgments,
      expandedQuery,
      5
    );
    const contextBlock = buildContextBlock(context);
    const glossaryHints = applyGlossaryTerms(
      req.datasets.glossary,
      sourceText,
      sourceLang,
      targetLang
    );

    const prompt = `
You are a professional legal translator.
Translate from ${sourceLang} to ${targetLang}.
Maintain legal terminology, tone, and precision.

Text:
${sourceText}

Legal Context:
${contextBlock}

Glossary Hints:
${glossaryHints.length ? glossaryHints.join("\n") : "No glossary hints available."}

Return only translated text.
`;

    const reply = await callLlm(prompt);
    if (!reply) {
      return res.status(503).json({ error: "LLM unavailable for translation" });
    }

    res.json({ translated_text: reply, sources: context });
  } catch (error) {
    console.error("/translate error:", error);
    res.status(500).json({ error: "Failed to translate document" });
  }
});

app.post("/feedback", requireAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.feature || !payload.event_type) {
      return res.status(400).json({ error: "feature and event_type required" });
    }
    await storeFeedbackEvent(payload);
    res.json({ ok: true });
  } catch (error) {
    console.error("/feedback error:", error);
    res.status(500).json({ error: "Failed to store feedback event" });
  }
});

app.post("/chat", requireApprovedLawyer, ensureIngestedData, async (req, res) => {
  try {
    const message = (req.body.message || "").toString();
    if (!message.trim()) return res.status(400).json({ error: "Message required" });

    const expandedQuery = expandQueryWithOntology(message, req.datasets.ontology);
    const context = retrieveLegalContext(req.datasets.statutes, req.datasets.judgments, expandedQuery, 6);

    const contextBlock = buildContextBlock(context);

    const groundedPrompt = `
You are a legal assistant for Indian law.
Answer using the provided context first. If context is insufficient, clearly say so.
Include citation markers like [S1], [S2] when using sources.
Do not fabricate statutes or case citations.

User Query:
${message}

Context:
${contextBlock}
`;

    const reply =
      (await callLlm(groundedPrompt)) ||
      `Based on available references:\n${context
        .map((c) => `- [${c.ref}] ${c.title}`)
        .join("\n") || "- No matching references found"}`;

    res.json({ reply, sources: context });
  } catch (error) {
    console.error("/chat error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
