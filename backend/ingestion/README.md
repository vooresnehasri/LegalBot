# Legal Data Ingestion (Official/Open Mode)

This ingestion pipeline is configured for **official/licensed APIs** and **vetted open datasets**.

Runtime policy in backend:
- App reads datasets from `backend/data/generated/*.json`
- If generated judgments+statutes are empty, `/chat` and `/cases` return `503`
- Seed/demo JSON files are **not** used for retrieval

## Configure sources
Edit `backend/ingestion/source-manifest.json`.

Current source classes:
- Official feeds (env-driven JSON URL)
- Licensed API (Indian Kanoon)
- Vetted open dataset (OpenNyAI JSONL)
- Official eCourts PDF forms (template extraction)

## Required environment variables (as applicable)
- `INDIA_CODE_DATA_URL`
- `ECOURTS_DATA_URL`
- `IK_API_TOKEN`

Set these in `backend/.env`.

## Commands
From `backend/`:
- Dry run: `npm run ingest:dry`
- Generate: `npm run ingest:run`
- Generate + apply: `npm run ingest:apply`

## Outputs
Written to `backend/data/generated/`:
- `judgments.json`
- `statutes.json`
- `templates.json`
- `provenance.json`

## Templates from official forms
`source-manifest.json` includes an official `ecourts_forms_pdf_urls` source that:
- downloads selected eCourts PDF forms
- extracts likely field labels from PDF text streams
- writes normalized `templates` records (`doc_type`, `required_fields`)

## Compliance
For each enabled source ensure:
- license/terms allow your intended use
- attribution/provenance retained
- access/robots/API limits respected
