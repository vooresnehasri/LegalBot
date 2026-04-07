import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileSearch, Loader2, Upload } from "lucide-react";
import { apiFetch } from "../lib/api.js";

export default function DocumentAnalyzer() {
  const [documentText, setDocumentText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null);

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
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      if (pageText.trim()) {
        parts.push(pageText.trim());
      }
    }

    return parts.join("\n\n");
  };

  const extractTextFromDocx = async (file) => {
    const mammoth = await import("mammoth");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value || "";
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const supported = [
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
      "application/rtf",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const fileName = file.name.toLowerCase();
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx");
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");

    if (!supported.includes(file.type) && !isDocx && !isPdf) {
      setUploadStatus("Unsupported file type. Upload TXT/MD/CSV/JSON/RTF/PDF/DOCX.");
      return;
    }

    try {
      let text = "";
      if (isPdf) {
        text = await extractTextFromPdf(file);
      } else if (isDocx) {
        text = await extractTextFromDocx(file);
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setUploadStatus("No readable text found in uploaded file.");
        return;
      }
      setDocumentText(text);
      setAnalysis(null);
      setUploadStatus(`Loaded: ${file.name}`);
    } catch {
      setUploadStatus("Failed to read file.");
    } finally {
      event.target.value = "";
    }
  };

  const analyzeDocument = async () => {
    if (!documentText.trim()) return;

    setLoading(true);
    setAnalysis(null);

    try {
      const response = await apiFetch("/analyze", {
        method: "POST",
        body: JSON.stringify({ documentText }),
      });

      if (!response.ok) {
        throw new Error("Analyzer request failed");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Document Analyzer</h1>
          <p className="text-slate-600">AI-powered legal document analysis</p>
        </motion.div>

        <div className="bg-white p-6 rounded-xl shadow mb-6">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.csv,.json,.rtf,.pdf,.docx,text/plain,text/markdown,text/csv,application/json,application/rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileUpload}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border py-2 rounded-lg mb-4 flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>

          {uploadStatus && (
            <p className="text-xs text-slate-600 mb-3">{uploadStatus}</p>
          )}

          <textarea
            rows={10}
            placeholder="Paste your legal document here..."
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 mb-4"
          />

          <button
            onClick={analyzeDocument}
            disabled={loading || !documentText.trim()}
            className="w-full bg-blue-600 text-white py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <FileSearch className="w-5 h-5" />
                Analyze Document
              </>
            )}
          </button>
        </div>

        {analysis && (
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl font-semibold mb-4">Analysis Result</h2>

            <div className="space-y-3 text-sm">
              <p>
                <strong>Document Type:</strong> {analysis.document_type}
              </p>
              <p>
                <strong>Category:</strong> {analysis.category}
              </p>

              <div>
                <strong>Predicted Sections:</strong>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysis.predicted_sections?.map((section, index) => (
                    <span key={index} className="bg-slate-100 px-2 py-1 rounded text-xs">
                      {section}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <strong>Risk Level:</strong>{" "}
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    analysis.risk_analysis?.risk_level === "high"
                      ? "bg-red-100 text-red-600"
                      : analysis.risk_analysis?.risk_level === "medium"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {analysis.risk_analysis?.risk_level}
                </span>
              </div>

              <p>
                <strong>Risk Reason:</strong> {analysis.risk_analysis?.reason}
              </p>

              <p>
                <strong>Summary:</strong> {analysis.summary}
              </p>

              {analysis.cited_sources?.length > 0 && (
                <div>
                  <strong>Cited Sources:</strong>
                  <div className="mt-2 space-y-1">
                    {analysis.cited_sources.slice(0, 5).map((s) => (
                      <div key={s.id} className="text-xs text-slate-600">
                        [{s.ref}] {s.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
