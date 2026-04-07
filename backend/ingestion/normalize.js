function slugify(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function isUsableTemplateField(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length < 3 || text.length > 60) return false;
  if (/[^\x20-\x7E]/.test(text)) return false;
  if (!/[a-z]/i.test(text)) return false;
  if (/\d{4}/.test(text)) return false;
  const lower = text.toLowerCase();
  const blocked = ["microsoft word", "unknown", " am", " pm"];
  if (blocked.some((token) => lower.includes(token))) return false;
  return true;
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function basenameFromPath(p = "") {
  const normalized = String(p).replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "";
}

function normalizeJudgment(record) {
  const inferJudgmentCategory = (text = "") => {
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

  if (typeof record === "string") {
    const file = basenameFromPath(record);
    const base = file.replace(/\.[a-z0-9]+$/i, "");
    const yearMatch = String(record).match(/year=(\d{4})/i) || base.match(/_(\d{4})-\d{2}-\d{2}$/);
    const benchMatch = String(record).match(/bench=([^/]+)/i);
    return {
      id: slugify(base || record),
      case_name: base || "Unnamed Judgment",
      citation: base || "Unknown citation",
      court: benchMatch?.[1] || "Unknown Court",
      year: Number(yearMatch?.[1]) || 0,
      summary: "Indexed judgment entry from official eCourts dataset.",
      key_sections: [],
      category: inferJudgmentCategory(`${base} ${record}`),
      tags: ["ecourts", "index"],
      source_url: String(record).startsWith("http") ? record : "",
    };
  }

  const pathLike =
    record.path ||
    record.file ||
    record.file_path ||
    record.pdf ||
    record.pdf_path ||
    record.pdf_url ||
    record.url ||
    record._key ||
    "";
  const pathBase = basenameFromPath(pathLike).replace(/\.[a-z0-9]+$/i, "");
  const metadataKeys = new Set([
    "year",
    "archive_type",
    "file_count",
    "total_size",
    "total_size_human",
    "created_at",
    "updated_at",
    "parts",
    "value",
  ]);

  // Drop scalar/map metadata entries from index-style JSON payloads.
  if (
    record &&
    typeof record === "object" &&
    "value" in record &&
    Object.keys(record).every((k) => ["value", "path", "_key"].includes(k))
  ) {
    return null;
  }

  if (metadataKeys.has(String(record._key || "").toLowerCase())) {
    return null;
  }

  if (metadataKeys.has(String(pathBase || "").toLowerCase())) {
    return null;
  }

  const caseName =
    record.case_name ||
    record.case_title ||
    record.title ||
    record.doc_title ||
    record.name ||
    record.case ||
    record.case_number ||
    record.caseNumber ||
    record.cnr ||
    record.diary_no ||
    pathBase ||
    [record.petitioner, record.respondent].filter(Boolean).join(" vs ");

  if (!caseName || metadataKeys.has(String(caseName).toLowerCase())) {
    return null;
  }

  const citation =
    record.citation ||
    record.neutral_citation ||
    record.cite ||
    record.courtcopy ||
    record.case_id ||
    record.cnr ||
    record.diary_no ||
    pathBase ||
    "Unknown citation";
  if (!caseName) return null;

  const dateText =
    record.date ||
    record.judgment_date ||
    record.order_date ||
    record.decision_date ||
    "";

  const sourceUrl =
    record.source_url ||
    record.url ||
    record.pdf_url ||
    record.pdf_link ||
    record.download_url ||
    "";

  return {
    id: record.id || slugify(`${caseName}-${citation}`),
    case_name: caseName,
    citation,
    court: record.court || record.court_name || record.bench || "Unknown Court",
    year: Number(record.year || String(dateText).slice(0, 4)) || 0,
    summary:
      record.summary ||
      record.headnote ||
      record.order_text?.slice(0, 400) ||
      record.snippet ||
      record.text?.slice(0, 400) ||
      "Summary unavailable from source",
    key_sections: record.key_sections || record.sections || [],
    category: (
      record.category ||
      inferJudgmentCategory(
        [
          caseName,
          citation,
          record.summary,
          record.headnote,
          record.order_text,
          record.snippet,
          record.text,
          ...(record.tags || []),
          pathLike,
        ]
          .filter(Boolean)
          .join(" ")
      )
    ).toLowerCase(),
    tags: record.tags || [],
    source_url: sourceUrl,
  };
}

function inferActName(text = "") {
  const hay = text.toLowerCase();
  if (hay.includes("indian penal code") || /\bipc\b/.test(hay)) return "Indian Penal Code, 1860";
  if (hay.includes("code of criminal procedure") || /\bcrpc\b/.test(hay)) return "Code of Criminal Procedure, 1973";
  if (hay.includes("indian contract act") || hay.includes("contract act")) return "Indian Contract Act, 1872";
  if (hay.includes("constitution of india") || hay.includes("article")) return "Constitution of India";
  if (hay.includes("negotiable instruments act") || hay.includes("ni act")) return "Negotiable Instruments Act, 1881";
  return "";
}

function inferSectionNo(text = "") {
  const sectionMatch = text.match(/\bsection\s+([0-9]+[a-z0-9()-]*)\b/i);
  if (sectionMatch?.[1]) return sectionMatch[1];

  const articleMatch = text.match(/\barticle\s+([0-9]+[a-z0-9()-]*)\b/i);
  if (articleMatch?.[1]) return `Article ${articleMatch[1]}`;

  return "";
}

function normalizeStatute(record) {
  const combinedText = [
    record.act_name,
    record.act,
    record.title,
    record.headline,
    record.snippet,
    record._query,
  ]
    .filter(Boolean)
    .join(" ");

  const actName =
    record.act_name ||
    record.act ||
    inferActName(combinedText) ||
    (record.title ? record.title.split("-")[0].trim() : "");

  const sectionNo =
    record.section_no ||
    record.section ||
    record.provision ||
    inferSectionNo(combinedText);

  if (!actName || !sectionNo) return null;

  return {
    id: record.id || record.tid || slugify(`${actName}-${sectionNo}`),
    act_name: actName,
    section_no: String(sectionNo),
    title: record.title || `${actName} - Section ${sectionNo}`,
    text:
      record.text ||
      record.section_text ||
      record.content ||
      record.headline ||
      record.snippet ||
      "Statute text unavailable from source result; fetch full text in enrichment step.",
    category: (record.category || "civil").toLowerCase(),
    tags: record.tags || [],
    source_url:
      record.source_url ||
      record.url ||
      (record.tid ? `https://indiankanoon.org/doc/${record.tid}/` : ""),
  };
}

function normalizeTemplate(record) {
  const docType =
    record.doc_type ||
    record.document_type ||
    record.template_name ||
    record.name;
  if (!docType) return null;

  const requiredFields = (Array.isArray(record.required_fields)
    ? record.required_fields
    : Array.isArray(record.fields)
    ? record.fields
    : [])
    .map((x) => String(x || "").replace(/\s+/g, " ").trim())
    .filter(isUsableTemplateField)
    .filter((field) => field.toLowerCase() !== String(docType).toLowerCase());

  const cleanedFields = requiredFields.length >= 2 ? requiredFields : [];
  const clauses = Array.isArray(record.clauses) ? record.clauses : [];
  const hasStructuredTemplateData =
    Boolean(record.doc_type || record.document_type || record.template_name) ||
    cleanedFields.length > 0 ||
    clauses.length > 0;
  if (!hasStructuredTemplateData) return null;

  return {
    id: record.id || slugify(`template-${docType}`),
    doc_type: docType,
    jurisdiction: record.jurisdiction || "India",
    required_fields: cleanedFields,
    clauses,
  };
}

function normalizeRiskLabel(record) {
  const text =
    record.text ||
    record.document_text ||
    record.content ||
    record.sentence ||
    record.preamble ||
    record.passage ||
    record.input;
  if (!text) return null;

  const labels = Array.isArray(record.labels)
    ? record.labels
    : Array.isArray(record.label)
    ? record.label
    : [record.label].filter((x) => x != null);

  const issues = labels
    .map((l) => String(l))
    .filter(Boolean)
    .map((l) => `Label signal: ${l}`);

  const riskLevel =
    labels.length >= 3
      ? "high"
      : labels.length >= 1
      ? "medium"
      : (record.risk_level || "low").toLowerCase();

  return {
    id: record.id || slugify(text.slice(0, 64)),
    text,
    document_type: record.document_type || record.doc_type || "unknown",
    risk_level: riskLevel,
    applicable_sections: record.applicable_sections || record.sections || [],
    issues_found: record.issues_found || issues,
    source_url: record.source_url || record.url || "",
  };
}

function normalizeGlossary(record) {
  const term_en =
    record.term_en ||
    record.english ||
    record.en ||
    record.sentence_en ||
    record.source ||
    record.term ||
    "";
  const term_hi =
    record.term_hi ||
    record.hindi ||
    record.hi ||
    record.sentence_hi ||
    record.target ||
    record.translation ||
    "";
  if (!term_en || !term_hi) return null;
  return {
    id: record.id || slugify(`${term_en}-${term_hi}`),
    term_en,
    term_hi,
    domain: record.domain || "general_legal",
    source_url: record.source_url || record.url || "",
  };
}

function normalizeOntology(record) {
  const key = record.key || record.id || record.topic || record.name;
  if (!key) return null;

  const aliases = Array.isArray(record.aliases)
    ? record.aliases
    : Array.isArray(record.names)
    ? record.names
    : [];

  return {
    key: String(key).toLowerCase(),
    label: record.label || record.name || record._type || String(key),
    parent: record.parent || null,
    aliases,
    source_url: record.source_url || record.url || "",
  };
}

function normalizeCitationEdge(record) {
  const from =
    record.from_case ||
    record.from ||
    record.source_case ||
    record.from_case_file_number ||
    record.from_case_name;
  const to =
    record.to_case ||
    record.to ||
    record.target_case ||
    record.to_case_file_number ||
    [record.to_law_book_code, record.to_law_book_section].filter(Boolean).join(" ");
  if (!from || !to) return null;
  return {
    id: record.id || slugify(`${from}-${to}`),
    from_case: from,
    to_case: to,
    relation: record.relation || "cites",
    source_url: record.source_url || record.url || "",
  };
}

export function normalizeByType(datasetType, records) {
  switch (datasetType) {
    case "judgments":
      return uniqBy(
        records.map(normalizeJudgment).filter(Boolean),
        (x) => `${x.case_name.toLowerCase()}|${x.citation.toLowerCase()}`
      );
    case "statutes":
      return uniqBy(
        records.map(normalizeStatute).filter(Boolean),
        (x) => `${x.act_name.toLowerCase()}|${x.section_no.toLowerCase()}`
      );
    case "templates":
      return uniqBy(
        records.map(normalizeTemplate).filter(Boolean),
        (x) => x.doc_type.toLowerCase()
      );
    case "risk_labels":
      return uniqBy(
        records.map(normalizeRiskLabel).filter(Boolean),
        (x) => x.id
      );
    case "glossary":
      return uniqBy(
        records.map(normalizeGlossary).filter(Boolean),
        (x) => x.id
      );
    case "ontology":
      return uniqBy(
        records.map(normalizeOntology).filter(Boolean),
        (x) => x.key
      );
    case "citation_graph":
      return uniqBy(
        records.map(normalizeCitationEdge).filter(Boolean),
        (x) => x.id
      );
    default:
      return [];
  }
}
