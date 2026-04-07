import React, { useState } from "react";
import { motion } from "framer-motion";
import { Languages, Loader2, ArrowLeftRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api.js";

const languages = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "ml", name: "Malayalam" },
  { code: "kn", name: "Kannada" },
  { code: "bn", name: "Bengali" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "pa", name: "Punjabi" },
];

export default function Translator() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sources, setSources] = useState([]);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("hi");
  const [isTranslating, setIsTranslating] = useState(false);

  const translateDocument = async () => {
    if (!sourceText.trim()) {
      toast.error("Please enter text to translate");
      return;
    }

    setIsTranslating(true);
    setSources([]);

    try {
      const sourceLangName =
        languages.find((l) => l.code === sourceLang)?.name || sourceLang;

      const targetLangName =
        languages.find((l) => l.code === targetLang)?.name || targetLang;

      const response = await apiFetch("/translate", {
        method: "POST",
        body: JSON.stringify({
          sourceText,
          sourceLang: sourceLangName,
          targetLang: targetLangName,
        }),
      });

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();
      setTranslatedText(data.translated_text || "");
      setSources(data.sources || []);
      toast.success("Translation completed!");
    } catch (error) {
      console.error(error);
      toast.error("Translation failed. Check backend.");
    } finally {
      setIsTranslating(false);
    }
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const copyTranslation = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-10 text-center"
        >
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Legal Translator
          </h1>
          <p className="text-slate-600">
            Translate legal documents between multiple languages
          </p>
        </motion.div>

        {/* Language Selector */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Source Language */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium mb-2">
                From Language
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={swapLanguages}
              className="mt-6 md:mt-0 bg-gray-200 hover:bg-gray-300 p-3 rounded-full transition"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </button>

            {/* Target Language */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium mb-2">
                To Language
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Translation Area */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Source */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Languages className="w-5 h-5" />
              Source Text
            </h2>

            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter legal text..."
              rows={14}
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={translateDocument}
              disabled={isTranslating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Languages className="w-5 h-5" />
                  Translate
                </>
              )}
            </button>
          </div>

          {/* Result */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Translation</h2>

            {translatedText ? (
              <>
                <div className="border rounded-lg p-4 mb-4 min-h-[320px] max-h-[320px] overflow-y-auto bg-gray-50">
                  <p className="whitespace-pre-wrap text-slate-700">
                    {translatedText}
                  </p>
                </div>

                <button
                  onClick={copyTranslation}
                  className="w-full border py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition"
                >
                  <Copy className="w-4 h-4" />
                  Copy Translation
                </button>

                {sources.length > 0 && (
                  <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Reference Sources</p>
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
                Enter text and click Translate
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
