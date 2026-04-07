import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { Buffer } from "node:buffer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INGESTION_ROOT = path.join(__dirname, "..");

function toArray(input) {
  if (Array.isArray(input)) return input;
  if (input == null) return [];
  if (typeof input === "object") {
    if (Array.isArray(input.rows)) {
      return input.rows.map((item) => item?.row ?? item).filter(Boolean);
    }

    if (input.dataset_info?.features) {
      return toArray(input.dataset_info.features);
    }

    const container =
      input.docs ||
      input.results ||
      input.data ||
      input.items ||
      input.records ||
      input.files ||
      input.entries ||
      input.judgments;
    if (Array.isArray(container)) return container;

    // Handle object maps (common in index JSON) by lifting values.
    const values = Object.values(input);
    if (values.length > 1 && values.every((v) => typeof v === "object")) {
      return values;
    }

    // Handle {"path/to/file.pdf": {...}} by preserving key as path hint.
    const entries = Object.entries(input);
    if (entries.length > 1) {
      return entries.map(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          return { ...v, path: v.path || v.file || k, _key: k };
        }
        return { value: v, path: k, _key: k };
      });
    }
  }
  return [input];
}

function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    return row;
  });
}

async function loadLocalJson(source) {
  const resolved = path.resolve(INGESTION_ROOT, source.path);
  const raw = await fs.readFile(resolved, "utf8");
  const parsed = JSON.parse(raw);
  return toArray(parsed);
}

async function loadJsonUrl(source, defaults) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": defaults.user_agent },
    signal: AbortSignal.timeout(defaults.timeout_ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.url}`);
  const parsed = await res.json();
  return toArray(parsed);
}

async function loadJsonUrlFromEnv(source, defaults) {
  const envName = source.url_env;
  const url = envName ? process.env[envName] : "";
  if (!url) throw new Error(`Missing ${envName} for source ${source.id}`);

  const res = await fetch(url, {
    headers: { "User-Agent": defaults.user_agent },
    signal: AbortSignal.timeout(defaults.timeout_ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const parsed = await res.json();
  return toArray(parsed);
}

async function loadCsvUrlFromEnv(source, defaults) {
  const envName = source.url_env;
  const url = envName ? process.env[envName] : "";
  if (!url) throw new Error(`Missing ${envName} for source ${source.id}`);

  return loadCsvUrl({ ...source, url }, defaults);
}

async function loadJsonlUrl(source, defaults) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": defaults.user_agent },
    signal: AbortSignal.timeout(defaults.timeout_ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.url}`);
  const text = await res.text();
  return parseJsonl(text);
}

async function loadCsvUrl(source, defaults) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": defaults.user_agent },
    signal: AbortSignal.timeout(defaults.timeout_ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.url}`);
  let text = "";
  if (source.url.endsWith(".gz")) {
    const buf = await res.arrayBuffer();
    text = zlib.gunzipSync(Buffer.from(buf)).toString("utf8");
  } else {
    text = await res.text();
  }
  return parseCsv(text);
}

async function loadIndianKanoon(source, defaults) {
  const token = process.env[source.config?.api_key_env || "IK_API_TOKEN"];
  if (!token) {
    throw new Error("Indian Kanoon token missing. Set IK_API_TOKEN.");
  }

  const queries = source.config?.queries || [];
  const limitPerQuery = Number(source.config?.limit_per_query ?? 10);
  const all = [];

  for (const q of queries) {
    const url = "https://api.indiankanoon.org/search/";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": defaults.user_agent,
        },
        body: `formInput=${encodeURIComponent(q)}&pagenum=0`,
        signal: AbortSignal.timeout(defaults.timeout_ms),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `IK search failed for query '${q}' with status ${res.status}. Body: ${body.slice(0, 300)}`
        );
      }

      const data = await res.json();
      const docs = toArray(data?.docs || data?.results || []).slice(0, limitPerQuery);
      all.push(...docs.map((d) => ({ ...d, _query: q })));
    } catch (error) {
      throw new Error(
        `IK request error for query '${q}': ${error?.message || "Unknown fetch error"}`
      );
    }
  }

  return all;
}

function normalizeFormNameFromUrl(url = "") {
  const pathPart = String(url).split("?")[0];
  const file = decodeURIComponent(pathPart.split("/").pop() || "");
  const base = file.replace(/\.pdf$/i, "");
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeFieldLabel(line = "") {
  if (!line) return false;
  const normalized = line.replace(/\s+/g, " ").trim();
  if (normalized.length < 3 || normalized.length > 42) return false;
  if (/[^\x20-\x7E]/.test(normalized)) return false;
  if (!/[a-z]/i.test(normalized)) return false;
  if (/[.?!]/.test(normalized)) return false;
  if (/\d{4}/.test(normalized)) return false;
  const lower = normalized.toLowerCase();
  const blocked = [
    "in the court",
    "versus",
    "whereof",
    "received",
    "signature",
    "accepted subject",
    "day of",
    "of 20",
    "for office use only",
    "microsoft word",
    "unknown",
    "am",
    "pm",
  ];
  if (blocked.some((b) => lower.includes(b))) return false;
  const likelyFieldTokens = [
    "name",
    "address",
    "date",
    "case",
    "court",
    "party",
    "advocate",
    "petitioner",
    "respondent",
    "appellant",
    "deponent",
    "amount",
    "fee",
    "email",
    "mobile",
    "phone",
    "subject",
    "facts",
    "description",
    "details",
    "signature",
  ];
  return likelyFieldTokens.some((token) => lower.includes(token));
}

function extractPdfLiteralStrings(pdfBuffer) {
  const raw = pdfBuffer.toString("latin1");
  const strings = [];
  const re = /\(([^()]*)\)/g;
  for (const match of raw.matchAll(re)) {
    const value = match[1]
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\/g, "");
    if (value.trim()) strings.push(value.trim());
  }
  return strings;
}

function inferCommonLegalFields(text = "") {
  const out = [];
  const lower = text.toLowerCase();
  if (lower.includes("court")) out.push("Court Name");
  if (lower.includes("case")) out.push("Case Number");
  if (lower.includes("plaintiff")) out.push("Plaintiff Name");
  if (lower.includes("respondent") || lower.includes("defendant")) out.push("Respondent/Defendant Name");
  if (lower.includes("advocate")) out.push("Advocate Name");
  if (lower.includes("date")) out.push("Date");
  if (lower.includes("address")) out.push("Address");
  return out;
}

function extractTemplateFieldsFromPdfBuffer(pdfBuffer) {
  const literals = extractPdfLiteralStrings(pdfBuffer);
  const labelCandidates = literals
    .map((s) => s.replace(/[_:]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(looksLikeFieldLabel);

  const fields = [];
  for (const candidate of labelCandidates) {
    if (!fields.some((f) => f.toLowerCase() === candidate.toLowerCase())) {
      fields.push(candidate);
    }
    if (fields.length >= 12) break;
  }

  const inferred = inferCommonLegalFields(literals.join(" "));
  for (const f of inferred) {
    if (!fields.some((x) => x.toLowerCase() === f.toLowerCase())) {
      fields.push(f);
    }
  }

  return fields.slice(0, 12);
}

async function loadEcourtsFormsPdfUrls(source, defaults) {
  const urls = source.config?.urls || [];
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("Missing config.urls for eCourts forms source");
  }

  const out = [];
  for (const url of urls) {
    const res = await fetch(url, {
      headers: { "User-Agent": defaults.user_agent },
      signal: AbortSignal.timeout(defaults.timeout_ms),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const buf = Buffer.from(await res.arrayBuffer());
    const docType = normalizeFormNameFromUrl(url);
    const requiredFields = extractTemplateFieldsFromPdfBuffer(buf);

    out.push({
      doc_type: docType || "Legal Form",
      required_fields: requiredFields,
      clauses: [],
      jurisdiction: "India",
      source_url: url,
    });
  }
  return out;
}

export async function loadSourceRecords(source, defaults) {
  switch (source.kind) {
    case "local_json":
      return loadLocalJson(source);
    case "json_url":
      return loadJsonUrl(source, defaults);
    case "json_url_env":
      return loadJsonUrlFromEnv(source, defaults);
    case "jsonl_url":
      return loadJsonlUrl(source, defaults);
    case "csv_url":
      return loadCsvUrl(source, defaults);
    case "csv_url_env":
      return loadCsvUrlFromEnv(source, defaults);
    case "indiankanoon_search":
      return loadIndianKanoon(source, defaults);
    case "ecourts_forms_pdf_urls":
      return loadEcourtsFormsPdfUrls(source, defaults);
    default:
      throw new Error(`Unsupported source kind: ${source.kind}`);
  }
}
