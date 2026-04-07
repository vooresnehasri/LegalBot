# Relevant Legal Data Sources (India)

## Official / Public Sources
1. India Code (Government of India)
- URL: https://www.indiacode.nic.in/
- Use for: statutes / bare acts metadata and text extraction
- Notes: authoritative source; extraction pipeline should respect robots/terms

2. Supreme Court of India / eCourts public portals
- URL: https://www.sci.gov.in/ and https://ecourts.gov.in/
- Use for: judgments and cause-list metadata
- Notes: authoritative but may require adapter per portal format

3. data.gov.in legal/governance datasets
- URL: https://www.data.gov.in/
- Use for: public notifications, governance/legal metadata
- Notes: APIs vary by resource ID and schema

## Open / Community Sources (license-check required)
1. OpenNyAI / Legal-NLP datasets
- URL: https://github.com/Legal-NLP-EkStep
- Use for: legal NLP corpora, benchmark datasets
- Notes: good for model evaluation and retrieval baselines

2. Indian Kanoon API
- URL: https://api.indiankanoon.org/documentation/
- Use for: searchable judgments/documents
- Notes: API-key based; follow API terms and attribution requirements

## Integration Status in this project
- Implemented adapter + manifest entries:
  - `local_json` (enabled)
  - `indiankanoon_search` (disabled by default; requires `IK_API_TOKEN`)
  - `jsonl_url` (disabled by default; can ingest OpenNyAI-style JSONL)

- Config file:
  - `backend/ingestion/source-manifest.json`

- Runner:
  - `backend/ingestion/run.js`

