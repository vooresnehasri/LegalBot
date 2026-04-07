import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { loadSourceRecords } from "./adapters/loaders.js";
import { normalizeByType } from "./normalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

function parseArgs(argv) {
  const flags = new Set(argv);
  return {
    dryRun: flags.has("--dry-run"),
    apply: flags.has("--apply"),
    manifest: path.resolve(__dirname, "source-manifest.json"),
    outputDir: path.resolve(ROOT, "data", "generated"),
  };
}

function validateManifest(manifest) {
  const issues = [];
  if (!manifest || typeof manifest !== "object") issues.push("Manifest must be an object");
  if (!Array.isArray(manifest?.sources)) issues.push("Manifest must include sources[]");

  for (const src of manifest.sources || []) {
    if (!src.id) issues.push("Source missing id");
    if (!src.kind) issues.push(`Source ${src.id} missing kind`);
    if (!src.dataset_type) issues.push(`Source ${src.id} missing dataset_type`);
    if (!src.license) issues.push(`Source ${src.id} missing license`);
    if (!src.provenance?.source_url) issues.push(`Source ${src.id} missing provenance.source_url`);
  }

  return issues;
}

async function readManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  const issues = validateManifest(manifest);
  if (issues.length > 0) {
    throw new Error(`Manifest validation failed:\n- ${issues.join("\n- ")}`);
  }
  return manifest;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function applyToActiveData(outputDir, aggregated) {
  const targets = [
    { file: "judgments.json", key: "judgments" },
    { file: "statutes.json", key: "statutes" },
    { file: "templates.json", key: "templates" },
    { file: "risk_labels.json", key: "risk_labels" },
    { file: "glossary.json", key: "glossary" },
    { file: "ontology.json", key: "ontology" },
    { file: "citation_graph.json", key: "citation_graph" },
  ];

  for (const target of targets) {
    const src = path.join(outputDir, target.file);
    const dest = path.join(ROOT, "data", target.file);
    const incomingCount = Array.isArray(aggregated[target.key]) ? aggregated[target.key].length : 0;

    if (incomingCount === 0) {
      try {
        const existingRaw = await fs.readFile(dest, "utf8");
        const existing = JSON.parse(existingRaw);
        if (Array.isArray(existing) && existing.length > 0) {
          continue;
        }
      } catch {
        // No existing valid data; proceed with copy.
      }
    }

    try {
      await fs.copyFile(src, dest);
    } catch {
      // ignore missing files
    }
  }
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const manifest = await readManifest(opts.manifest);
  const defaults = manifest.defaults || {};

  const aggregated = {
    judgments: [],
    statutes: [],
    templates: [],
    risk_labels: [],
    glossary: [],
    ontology: [],
    citation_graph: [],
  };
  const provenance = [];

  for (const source of manifest.sources) {
    if (!source.enabled) continue;

    try {
      const records = await loadSourceRecords(source, defaults);
      const normalized = normalizeByType(source.dataset_type, records);

      aggregated[source.dataset_type] = [
        ...(aggregated[source.dataset_type] || []),
        ...normalized,
      ];

      provenance.push({
        source_id: source.id,
        dataset_type: source.dataset_type,
        raw_records: records.length,
        normalized_records: normalized.length,
        license: source.license,
        source_url: source.provenance?.source_url || "",
        ingested_at: new Date().toISOString(),
      });
    } catch (error) {
      provenance.push({
        source_id: source.id,
        dataset_type: source.dataset_type,
        error: error.message,
        ingested_at: new Date().toISOString(),
      });
    }
  }

  await ensureDir(opts.outputDir);
  await writeJson(path.join(opts.outputDir, "judgments.json"), aggregated.judgments);
  await writeJson(path.join(opts.outputDir, "statutes.json"), aggregated.statutes);
  await writeJson(path.join(opts.outputDir, "templates.json"), aggregated.templates);
  await writeJson(path.join(opts.outputDir, "risk_labels.json"), aggregated.risk_labels);
  await writeJson(path.join(opts.outputDir, "glossary.json"), aggregated.glossary);
  await writeJson(path.join(opts.outputDir, "ontology.json"), aggregated.ontology);
  await writeJson(path.join(opts.outputDir, "citation_graph.json"), aggregated.citation_graph);
  await writeJson(path.join(opts.outputDir, "provenance.json"), provenance);

  if (opts.apply && !opts.dryRun) {
    await applyToActiveData(opts.outputDir, aggregated);
  }

  const totalCount =
    aggregated.judgments.length +
    aggregated.statutes.length +
    aggregated.templates.length +
    aggregated.risk_labels.length +
    aggregated.glossary.length +
    aggregated.ontology.length +
    aggregated.citation_graph.length;
  const failedSources = provenance.filter((p) => p.error);

  console.log(
    JSON.stringify(
      {
        dryRun: opts.dryRun,
        apply: opts.apply,
        outputDir: opts.outputDir,
        counts: {
          judgments: aggregated.judgments.length,
          statutes: aggregated.statutes.length,
          templates: aggregated.templates.length,
          risk_labels: aggregated.risk_labels.length,
          glossary: aggregated.glossary.length,
          ontology: aggregated.ontology.length,
          citation_graph: aggregated.citation_graph.length,
        },
      },
      null,
      2
    )
  );

  if (failedSources.length) {
    console.error("\nIngestion source errors:");
    for (const item of failedSources) {
      console.error(`- ${item.source_id}: ${item.error}`);
    }
  }

  if (totalCount === 0) {
    throw new Error(
      "No records ingested from enabled sources. Check source URLs/tokens and source format."
    );
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
