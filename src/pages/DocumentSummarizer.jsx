import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Loader2, Copy, Download, Upload } from "lucide-react";
import { apiFetch } from "../lib/api.js";
export default function DocumentSummarizer() {
  const [documentText, setDocumentText] = useState("");
  const [summary, setSummary] = useState("");
  const [sources, setSources] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
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
      setSummary("");
      setSources([]);
      setUploadStatus(`Loaded: ${file.name}`);
    } catch {
      setUploadStatus("Failed to read file.");
    } finally {
      event.target.value = "";
    }
  };

  const summarizeDocument = async () => {
    if (!documentText.trim()) return;

    setIsSummarizing(true);
    setSummary("");
    setSources([]);

    try {
      const response = await apiFetch("/summarize", {
        method: "POST",
        body: JSON.stringify({
          documentText,
        }),
      });

      if (!response.ok) {
        throw new Error("Summarization failed");
      }

      const data = await response.json();
      setSummary(data.summary || "");
      setSources(data.sources || []);

    } catch (error) {
      console.error(error);
      alert("Summarization failed.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
    alert("Summary copied!");
  };

  const downloadSummary = () => {
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Document Summarizer
          </h1>
          <p className="text-slate-600">
            Get AI-powered summaries of legal documents
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="flex items-center gap-2 font-semibold mb-4">
              <FileText className="w-5 h-5" />
              Document Input
            </h2>

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
              placeholder="Paste your legal document here..."
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              rows={15}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />

            <button
              onClick={summarizeDocument}
              disabled={isSummarizing || !documentText.trim()}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Summarizing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Summarize Document
                </>
              )}
            </button>
          </div>

          {/* Output */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-semibold mb-4">Summary</h2>

            {summary ? (
              <>
                <div className="border rounded-lg p-4 max-h-[500px] overflow-y-auto mb-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {summary}
                  </pre>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={copySummary}
                    className="flex-1 border py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>

                  <button
                    onClick={downloadSummary}
                    className="flex-1 border py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>

                {sources.length > 0 && (
                  <div className="mt-4 rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Grounding Sources</p>
                    <ul className="space-y-1">
                      {sources.slice(0, 4).map((s) => (
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
                Paste a document and click Summarize
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
