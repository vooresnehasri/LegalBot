import React, { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, Loader2 } from "lucide-react";
import { apiFetch, API_BASE_URL } from "../lib/api.js";

export default function CaseLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [recordTypeFilter, setRecordTypeFilter] = useState("all");
  const [availableCategories, setAvailableCategories] = useState(["all"]);
  const [availableRecordTypes, setAvailableRecordTypes] = useState(["all"]);
  const [isSearching, setIsSearching] = useState(false);
  const [cases, setCases] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [totalMatches, setTotalMatches] = useState(0);

  React.useEffect(() => {
    searchCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchCases = async () => {
    setIsSearching(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        category: categoryFilter,
        record_type: recordTypeFilter,
      });

      const response = await apiFetch(`/cases?${params.toString()}`);
      if (!response.ok) {
        let message = "Failed to fetch cases";
        try {
          const payload = await response.json();
          if (payload?.error) {
            message = payload.error;
          }
          if (payload?.hint) {
            message = `${message} (${payload.hint})`;
          }
        } catch {
          // Keep generic fallback message for non-JSON responses.
        }
        throw new Error(message);
      }

      const data = await response.json();
      const rows = Array.isArray(data.cases) ? data.cases : [];
      setCases(rows);

      const derivedCategories = ["all", ...Array.from(new Set(rows.map((r) => String(r.category || "unknown").toLowerCase()))).sort()];
      const derivedTypes = ["all", ...Array.from(new Set(rows.map((r) => String(r.record_type || "unknown").toLowerCase()))).sort()];
      const backendCategories = Array.isArray(data.available_categories) ? data.available_categories : [];
      const backendTypes = Array.isArray(data.available_record_types) ? data.available_record_types : [];

      const mergedCategories = Array.from(new Set([...backendCategories, ...derivedCategories].map((x) => String(x).toLowerCase())));
      const mergedTypes = Array.from(new Set([...backendTypes, ...derivedTypes].map((x) => String(x).toLowerCase())));

      setAvailableCategories(mergedCategories.length ? mergedCategories : ["all"]);
      setAvailableRecordTypes(mergedTypes.length ? mergedTypes : ["all"]);
      setTotalMatches(Number(data.total_matches) || rows.length);
    } catch (error) {
      console.error("Search failed:", error);
      setCases([]);
      setErrorMessage(error?.message || "Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const filteredCases = cases;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Case Library</h1>
          <p className="text-slate-600">Search and explore legal precedents</p>
        </motion.div>

        <div className="bg-white p-6 rounded-xl shadow mb-8">
          <div className="flex gap-3">
            <input
              placeholder="Search case name or legal topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCases()}
              className="flex-1 border rounded-lg px-4 py-2"
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={recordTypeFilter}
              onChange={(e) => setRecordTypeFilter(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              {availableRecordTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All Types" : t.replace(/_/g, " ")}
                </option>
              ))}
            </select>

            <button
              onClick={searchCases}
              className="bg-blue-600 text-white px-4 rounded-lg flex items-center justify-center"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {errorMessage ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {!errorMessage && (
            <p className="mt-3 text-xs text-slate-500">
              Showing {filteredCases.length} of {totalMatches} matched records
            </p>
          )}
        </div>

        {filteredCases.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredCases.map((caseItem, index) => (
              <motion.div key={`${caseItem.case_name}_${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white p-6 rounded-xl shadow">
                  <h2 className="text-lg font-semibold mb-2">{caseItem.case_name}</h2>

                  <p className="text-sm text-slate-500 mb-2">
                    {caseItem.citation} • {caseItem.court} • {caseItem.year}
                  </p>

                  <p className="text-sm text-slate-700 mb-3">{caseItem.summary}</p>

                  <div className="flex flex-wrap gap-2">
                    {caseItem.key_sections?.map((section, i) => (
                      <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded">
                        {section}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex gap-2 items-center">
                      <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded capitalize">
                        {caseItem.category}
                      </span>
                      <span className="inline-block text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded capitalize">
                        {(caseItem.record_type || "record").replace(/_/g, " ")}
                      </span>
                    </div>
                    {caseItem.source_url ? (
                      <a
                        href={caseItem.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Source
                      </a>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          !isSearching && (
            <div className="bg-white p-20 text-center rounded-xl shadow text-slate-400">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              No cases found.
            </div>
          )
        )}
      </div>
    </div>
  );
}
