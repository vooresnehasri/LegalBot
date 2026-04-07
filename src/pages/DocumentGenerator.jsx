import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  Download,
  Sparkles,
  Upload,
  FileBadge2,
  Trash2,
} from "lucide-react";
import { apiFetch } from "../lib/api.js";

export default function DocumentGenerator() {
  const proofTypes = [
    "Identity Proof",
    "Address Proof",
    "Agreement / Contract",
    "Payment Proof",
    "Communication Proof",
    "Medical Proof",
    "Police / Court Record",
    "Property Proof",
    "Other Supporting Document",
  ];
  const draftingTypes = [
    "FIR",
    "Affidavit",
    "Contract",
    "Notice",
    "Legal Notice",
    "Lease Agreement",
    "Sale Deed",
    "Will",
    "Custom",
  ];

  const [mode, setMode] = useState("legal_drafting");
  const [templates, setTemplates] = useState({});
  const [documentType, setDocumentType] = useState("");
  const [draftType, setDraftType] = useState("FIR");
  const [customDocumentType, setCustomDocumentType] = useState("");
  const [customDetails, setCustomDetails] = useState("");
  const [formData, setFormData] = useState({});
  const [generatedDocument, setGeneratedDocument] = useState("");
  const [generatedDocumentType, setGeneratedDocumentType] = useState("document");
  const [sources, setSources] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [guidedEnabled, setGuidedEnabled] = useState(true);
  const [guideHistory, setGuideHistory] = useState([]);
  const [guideQuestion, setGuideQuestion] = useState("");
  const [guideAnswer, setGuideAnswer] = useState("");
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideReady, setGuideReady] = useState(false);
  const [guideMissingPoints, setGuideMissingPoints] = useState([]);
  const [suggestingType, setSuggestingType] = useState(false);
  const [suggestedType, setSuggestedType] = useState("");
  const [suggestedAlternatives, setSuggestedAlternatives] = useState([]);
  const [suggestedReasoning, setSuggestedReasoning] = useState("");
  const [supportingDocuments, setSupportingDocuments] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");

  const sanitizeFields = (fields = [], docType = "") => {
    const normalizedDocType = String(docType || "").trim().toLowerCase();
    const cleaned = fields
      .map((f) => String(f || "").replace(/\s+/g, " ").trim())
      .filter((f) => {
        if (!f || f.length < 3 || f.length > 60) return false;
        if (/[^\x20-\x7E]/.test(f)) return false;
        if (!/[a-z]/i.test(f)) return false;
        if (/\d{4}/.test(f)) return false;
        const lower = f.toLowerCase();
        if (
          lower.includes("microsoft word") ||
          lower === "unknown" ||
          lower.endsWith(" am") ||
          lower.endsWith(" pm")
        ) {
          return false;
        }
        if (normalizedDocType && lower === normalizedDocType) return false;
        return true;
      });
    return cleaned.length >= 2 ? cleaned : [];
  };

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await apiFetch("/templates");
        if (!response.ok) {
          setTemplatesLoaded(true);
          return;
        }
        const data = await response.json();
        const mapped = (data.templates || []).reduce((acc, t) => {
          if (t.doc_type && Array.isArray(t.required_fields)) {
            acc[t.doc_type] = {
              fields: sanitizeFields(t.required_fields, t.doc_type),
            };
          }
          return acc;
        }, {});
        setTemplates(mapped);
        const first = Object.keys(mapped)[0] || "";
        setDocumentType((prev) => (mapped[prev] ? prev : first));
      } catch {
        // No local fallback: strict public/offical data mode.
      } finally {
        setTemplatesLoaded(true);
      }
    };
    loadTemplates();
  }, []);

  const extractTextFromPdf = async (file) => {
    const pdfjsLib = await import("pdfjs-dist");
    const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const parts = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      if (pageText.trim()) parts.push(pageText.trim());
    }

    return parts.join("\n\n");
  };

  const extractTextFromDocx = async (file) => {
    const mammoth = await import("mammoth");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value || "";
  };

  const handleSupportingUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const isDocx =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx");

    setUploadStatus(`Reading ${file.name}...`);

    try {
      let extractedText = "";
      if (isPdf) {
        extractedText = await extractTextFromPdf(file);
      } else if (isDocx) {
        extractedText = await extractTextFromDocx(file);
      } else {
        extractedText = await file.text();
      }

      const nextDoc = {
        id: `${file.name}_${Date.now()}`,
        name: file.name,
        size: file.size,
        mime_type: file.type || "application/octet-stream",
        proof_type: "Other Supporting Document",
        description: "",
        extracted_text: (extractedText || "").slice(0, 12000),
      };

      setSupportingDocuments((prev) => [...prev, nextDoc]);
      setUploadStatus(`Added ${file.name}`);
    } catch {
      setUploadStatus(`Could not extract readable text from ${file.name}. Try PDF, DOCX, TXT, CSV, JSON, or MD.`);
    } finally {
      event.target.value = "";
    }
  };

  const updateSupportingDocument = (id, key, value) => {
    setSupportingDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, [key]: value } : doc))
    );
  };

  const removeSupportingDocument = (id) => {
    setSupportingDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const effectiveDraftDocumentType =
    draftType === "Custom" ? customDocumentType.trim() : draftType;

  const resetGuide = () => {
    setGuideHistory([]);
    setGuideQuestion("");
    setGuideAnswer("");
    setGuideReady(false);
    setGuideMissingPoints([]);
  };

  const applySuggestedType = (type) => {
    const selected = String(type || "").trim();
    if (!selected) return;
    setDraftType("Custom");
    setCustomDocumentType(selected);
    resetGuide();
  };

  const suggestDocumentType = async () => {
    const issueText = customDetails.trim();
    if (!issueText) {
      alert("Describe your issue first, then click Help me choose document type.");
      return;
    }

    setSuggestingType(true);
    try {
      const response = await apiFetch("/suggest-document-type", {
        method: "POST",
        body: JSON.stringify({
          issueText,
          history: guideHistory,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to suggest document type");
      }

      setSuggestedType(data.primary_type || "");
      setSuggestedAlternatives(Array.isArray(data.alternatives) ? data.alternatives : []);
      setSuggestedReasoning(data.reasoning || "");
      if (data.primary_type) {
        applySuggestedType(data.primary_type);
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to suggest document type");
    } finally {
      setSuggestingType(false);
    }
  };

  const runGuideTurn = async (updatedHistory) => {
    setGuideLoading(true);
    try {
      const response = await apiFetch("/drafting-guide-turn", {
        method: "POST",
        body: JSON.stringify({
          mode: "legal_drafting",
          documentType: effectiveDraftDocumentType,
          history: updatedHistory,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Guided intake failed");
      }
      setGuideHistory(updatedHistory);
      setGuideMissingPoints(data.missing_points || []);
      if (data.ready) {
        setGuideReady(true);
        setGuideQuestion("");
        if (data.draft_details) {
          setCustomDetails(data.draft_details);
        }
      } else {
        setGuideReady(false);
        setGuideQuestion(data.next_question || "Please share the next missing detail.");
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Guided intake failed.");
    } finally {
      setGuideLoading(false);
    }
  };

  const generateDocument = async () => {
    const effectiveDocumentType = mode === "legal_drafting"
      ? (draftType === "Custom" ? customDocumentType.trim() : draftType)
      : (documentType || customDocumentType.trim());
    if (!effectiveDocumentType) {
      alert("Enter a document type to generate.");
      return;
    }
    if (mode === "legal_drafting" && guidedEnabled && !guideReady) {
      alert("Complete the guided questions first, or turn off Guided Intake.");
      return;
    }
    setIsGenerating(true);
    setGeneratedDocument("");
    setSources([]);

    try {
      const response = await apiFetch("/generate-document", {
        method: "POST",
        body: JSON.stringify({
          mode,
          documentType: effectiveDocumentType,
          supportingDocuments,
          formData: mode === "legal_drafting"
            ? { Details: customDetails }
            : (Object.keys(templates).length
                ? (templates[effectiveDocumentType]?.fields?.length
                    ? formData
                    : { Details: customDetails })
                : { Details: customDetails }),
        }),
      });

      if (!response.ok) {
        throw new Error("Document generation failed");
      }

      const data = await response.json();
      setGeneratedDocument(data.document || "");
      setSources(data.sources || []);
      setGeneratedDocumentType(effectiveDocumentType || "document");

    } catch (error) {
      console.error(error);
      alert("Document generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadDocument = () => {
    const blob = new Blob([generatedDocument], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedDocumentType}_${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Document Generator
          </h1>
          <p className="text-slate-600">
            Generate professional legal documents using AI
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="flex items-center gap-2 font-semibold mb-6">
              <FileText className="w-5 h-5" />
              Document Details
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setGeneratedDocument("");
                  if (e.target.value !== "legal_drafting") {
                    resetGuide();
                  }
                }}
                className="w-full border rounded-lg px-4 py-2"
              >
                <option value="legal_drafting">Legal Drafting</option>
                <option value="official_forms">Official Court Forms</option>
              </select>
            </div>

            {mode === "official_forms" && Object.keys(templates).length ? (
                <select
                  value={documentType}
                  onChange={(e) => {
                    setDocumentType(e.target.value);
                    setFormData({});
                    setGeneratedDocument("");
                  }}
                  className="w-full border rounded-lg px-4 py-2 mb-6"
                >
                  {Object.keys(templates).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              ) : mode === "official_forms" ? (
                <div className="mb-6 space-y-3">
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {templatesLoaded
                      ? "No public templates available. Enter document type and details."
                      : "Loading templates..."}
                  </div>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Document type (e.g., FIR, Affidavit, Contract)"
                    value={customDocumentType}
                    onChange={(e) => setCustomDocumentType(e.target.value)}
                  />
                  <textarea
                    rows={6}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Enter facts, parties, dates, and required clauses..."
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                  />
                </div>
              ) : (
                <div className="mb-6 space-y-3">
                  <select
                    value={draftType}
                    onChange={(e) => {
                      setDraftType(e.target.value);
                      resetGuide();
                    }}
                    className="w-full border rounded-lg px-4 py-2"
                  >
                    {draftingTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {draftType === "Custom" && (
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Custom document type"
                      value={customDocumentType}
                      onChange={(e) => {
                        setCustomDocumentType(e.target.value);
                        resetGuide();
                      }}
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={guidedEnabled}
                      onChange={(e) => {
                        setGuidedEnabled(e.target.checked);
                        if (!e.target.checked) resetGuide();
                      }}
                    />
                    Guided Intake (LLM follow-up questions)
                  </label>

                  <button
                    type="button"
                    onClick={suggestDocumentType}
                    disabled={suggestingType || !customDetails.trim()}
                    className="w-full border py-2 rounded-lg"
                  >
                    {suggestingType ? "Choosing..." : "Help me choose document type"}
                  </button>

                  {!!suggestedType && (
                    <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                      <p className="font-medium">
                        Suggested Type: {suggestedType}
                      </p>
                      {!!suggestedReasoning && (
                        <p className="text-slate-600 mt-1">{suggestedReasoning}</p>
                      )}
                      {!!suggestedAlternatives.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestedAlternatives.map((alt) => (
                            <button
                              key={alt}
                              type="button"
                              onClick={() => applySuggestedType(alt)}
                              className="border rounded px-2 py-1 text-xs"
                            >
                              Use {alt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {guidedEnabled ? (
                    <div className="space-y-3">
                      {!guideHistory.length && !guideQuestion && !guideReady && (
                        <>
                          <textarea
                            rows={4}
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="Describe your issue in plain language..."
                            value={customDetails}
                            onChange={(e) => setCustomDetails(e.target.value)}
                          />
                          <button
                            type="button"
                            disabled={guideLoading || !customDetails.trim()}
                            onClick={() =>
                              runGuideTurn([
                                {
                                  question: "Describe your issue in plain language.",
                                  answer: customDetails.trim(),
                                },
                              ])
                            }
                            className="w-full border py-2 rounded-lg"
                          >
                            {guideLoading ? "Starting..." : "Start Guided Intake"}
                          </button>
                        </>
                      )}

                      {guideHistory.length > 0 && (
                        <div className="rounded-lg border bg-slate-50 p-3 max-h-44 overflow-y-auto">
                          {guideHistory.map((item, idx) => (
                            <div key={`${idx}-${item.question}`} className="mb-2 text-sm">
                              <p className="font-medium">Q: {item.question}</p>
                              <p className="text-slate-600">A: {item.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {!guideReady && guideQuestion && (
                        <>
                          <p className="text-sm font-medium">{guideQuestion}</p>
                          <textarea
                            rows={3}
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="Type your answer..."
                            value={guideAnswer}
                            onChange={(e) => setGuideAnswer(e.target.value)}
                          />
                          <button
                            type="button"
                            disabled={guideLoading || !guideAnswer.trim()}
                            onClick={() => {
                              const updated = [
                                ...guideHistory,
                                { question: guideQuestion, answer: guideAnswer.trim() },
                              ];
                              setGuideAnswer("");
                              runGuideTurn(updated);
                            }}
                            className="w-full border py-2 rounded-lg"
                          >
                            {guideLoading ? "Processing..." : "Submit Answer"}
                          </button>
                        </>
                      )}

                      {guideReady && (
                        <>
                          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                            Guided intake complete. You can edit the structured brief below before generation.
                          </div>
                          {!!guideMissingPoints.length && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              Missing/optional details: {guideMissingPoints.join(", ")}
                            </div>
                          )}
                          <textarea
                            rows={8}
                            className="w-full border rounded-lg px-3 py-2"
                            value={customDetails}
                            onChange={(e) => setCustomDetails(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={resetGuide}
                            className="w-full border py-2 rounded-lg"
                          >
                            Restart Guided Intake
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <textarea
                      rows={6}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Enter facts, parties, dates, obligations, and relief sought..."
                      value={customDetails}
                      onChange={(e) => setCustomDetails(e.target.value)}
                    />
                  )}
                </div>
              )}

            {mode === "official_forms" &&
              Object.keys(templates).length &&
              templates[documentType]?.fields?.map((field) => (
              <div key={field} className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  {field}
                </label>

                {field.includes("Description") ||
                field.includes("Statement") ||
                field.includes("Facts") ||
                field.includes("Terms") ? (
                  <textarea
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData[field] || ""}
                    onChange={(e) =>
                      handleInputChange(field, e.target.value)
                    }
                  />
                ) : (
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData[field] || ""}
                    onChange={(e) =>
                      handleInputChange(field, e.target.value)
                    }
                  />
                )}
              </div>
            ))}

            {mode === "official_forms" &&
              Object.keys(templates).length &&
              documentType &&
              !(templates[documentType]?.fields?.length) && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Details
                  </label>
                  <textarea
                    rows={6}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Enter facts, parties, dates, and required clauses..."
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                  />
                </div>
              )}

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileBadge2 className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-slate-900">Supporting Documents</h3>
                  <p className="text-sm text-slate-500">
                    Upload any proof related to this matter: agreements, receipts, chats, IDs, FIR copies, medical or property records.
                  </p>
                </div>
              </div>

              <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Add Supporting Document
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.csv,.json,.rtf,.pdf,.docx,text/plain,text/markdown,text/csv,application/json,application/rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleSupportingUpload}
                />
              </label>

              {uploadStatus ? <p className="mb-3 text-xs text-slate-500">{uploadStatus}</p> : null}

              {supportingDocuments.length ? (
                <div className="space-y-3">
                  {supportingDocuments.map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{doc.name}</p>
                          <p className="text-xs text-slate-500">
                            {Math.max(1, Math.round(doc.size / 1024))} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSupportingDocument(doc.id)}
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <select
                          value={doc.proof_type}
                          onChange={(e) => updateSupportingDocument(doc.id, "proof_type", e.target.value)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          {proofTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <input
                          value={doc.description}
                          onChange={(e) => updateSupportingDocument(doc.id, "description", e.target.value)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Optional note: what this file proves"
                        />
                      </div>

                      <textarea
                        rows={4}
                        value={doc.extracted_text}
                        onChange={(e) => updateSupportingDocument(doc.id, "extracted_text", e.target.value)}
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Extracted text appears here. You can edit it before generation."
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No supporting documents added yet. This is optional, but it helps the draft use real facts and annexures.
                </p>
              )}
            </div>

            <button
              onClick={generateDocument}
              disabled={
                isGenerating ||
                (mode === "official_forms"
                  ? (!documentType && !customDocumentType.trim())
                  : ((draftType === "Custom" && !customDocumentType.trim()) ||
                    (guidedEnabled ? !guideReady : !customDetails.trim())))
              }
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Document
                </>
              )}
            </button>
          </div>

          {/* Output */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-semibold mb-4">
              Generated Document
            </h2>

            {generatedDocument ? (
              <>
                <div className="border rounded-lg p-4 max-h-[500px] overflow-y-auto mb-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {generatedDocument}
                  </pre>
                </div>

                <button
                  onClick={downloadDocument}
                  className="w-full border py-3 rounded-lg flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>

                {sources.length > 0 && (
                  <div className="mt-4 rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Grounding Sources</p>
                    <ul className="space-y-1">
                      {sources.slice(0, 3).map((s) => (
                        <li key={s.id} className="text-xs text-slate-600">
                          [{s.ref}] {s.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-slate-400">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                Fill details and generate document
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
