import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileBadge2,
  FileCheck2,
  FileWarning,
  FolderKanban,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { apiFetch } from "../lib/api.js";

function normalize(text = "") {
  return String(text || "").toLowerCase();
}

function inferMissingFacts(doc) {
  const source = `${doc.content || ""} ${(doc.issues_found || []).join(" ")}`.toLowerCase();
  const missing = [];
  if (!/(party|complainant|accused|deponent|client)/.test(source)) missing.push("Party details");
  if (!/(date|timeline|day|month|year)/.test(source)) missing.push("Timeline");
  if (!/(section|article|act|legal basis|provision)/.test(source)) missing.push("Legal basis");
  if (!/(prayer|relief|demand|claim)/.test(source)) missing.push("Relief");
  return missing;
}

function summarizeMatter(doc, index) {
  const missing = inferMissingFacts(doc);
  const risk = normalize(doc.risk_analysis?.risk_level || "unknown");
  const sourceCount = Array.isArray(doc.cited_sources) ? doc.cited_sources.length : 0;

  return {
    id: doc.id || `matter_${index}`,
    title: doc.document_type || "Untitled Matter",
    stage: risk === "high" ? "Needs senior review" : risk === "medium" ? "Draft review" : "Ready for refinement",
    risk,
    createdAt: doc.created_at || "",
    summary: doc.content || "No summary available.",
    sections: doc.predicted_sections || [],
    issues: doc.issues_found || [],
    missing,
    sourceCount,
    nextStep:
      risk === "high"
        ? "Review supporting facts and escalate for legal sign-off."
        : risk === "medium"
        ? "Tighten missing clauses and confirm facts with client."
        : "Prepare final draft and annexure list.",
  };
}

export default function Analytics() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await apiFetch("/analytics");
        const data = await response.json();
        const docs = Array.isArray(data?.documents) ? data.documents : [];
        setDocuments(docs);
      } catch (error) {
        console.error("Failed to fetch workspace data:", error);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, []);

  const matters = useMemo(
    () => documents.map((doc, index) => summarizeMatter(doc, index)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [documents]
  );

  const highlightedMatter = matters[0] || null;

  const stats = useMemo(() => {
    const highRisk = matters.filter((matter) => matter.risk === "high").length;
    const missingFacts = matters.reduce((total, matter) => total + matter.missing.length, 0);
    const evidenceRefs = matters.reduce((total, matter) => total + matter.sourceCount, 0);
    return {
      totalMatters: matters.length,
      highRisk,
      missingFacts,
      evidenceRefs,
    };
  }, [matters]);

  const priorityQueue = useMemo(
    () =>
      matters
        .filter((matter) => matter.risk === "high" || matter.risk === "medium" || matter.missing.length > 0)
        .slice(0, 6),
    [matters]
  );

  const recentDocuments = useMemo(() => matters.slice(0, 4), [matters]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading workspace...</div>;
  }

  if (!matters.length) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-xl rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">No workspace records yet</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This workspace now shows only records created by your own lawyer account. Analyze a document first, and your matter activity will start appearing here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edf2f7] py-8">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <FolderKanban className="h-4 w-4" />
            Matter Workspace
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">Work on matters, not charts.</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Organize risk review, supporting legal context, missing facts, and next drafting actions in one legal workspace.
          </p>
        </motion.div>

        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Open Matters" value={stats.totalMatters} icon={<BriefcaseBusiness className="h-5 w-5" />} tone="blue" />
          <StatCard title="High Risk Reviews" value={stats.highRisk} icon={<ShieldAlert className="h-5 w-5" />} tone="red" />
          <StatCard title="Missing Fact Signals" value={stats.missingFacts} icon={<FileWarning className="h-5 w-5" />} tone="amber" />
          <StatCard title="Evidence References" value={stats.evidenceRefs} icon={<Scale className="h-5 w-5" />} tone="emerald" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Featured Matter</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">{highlightedMatter.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{highlightedMatter.summary}</p>
              </div>
              <RiskBadge risk={highlightedMatter.risk} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InsightCard
                icon={<Clock3 className="h-4 w-4" />}
                label="Current Stage"
                value={highlightedMatter.stage}
                helper={highlightedMatter.nextStep}
              />
              <InsightCard
                icon={<FileCheck2 className="h-4 w-4" />}
                label="Detected Sections"
                value={highlightedMatter.sections.length ? highlightedMatter.sections.join(", ") : "Needs legal review"}
                helper="Predicted provisions extracted from current matter."
              />
              <InsightCard
                icon={<FileBadge2 className="h-4 w-4" />}
                label="Grounding Sources"
                value={`${highlightedMatter.sourceCount} references`}
                helper="Cases and statutes used to support the review."
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Panel title="Key Risks" icon={<AlertTriangle className="h-4 w-4" />}>
                {highlightedMatter.issues.length ? (
                  <div className="flex flex-wrap gap-2">
                    {highlightedMatter.issues.slice(0, 8).map((issue) => (
                      <span key={issue} className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                        {issue}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No major issue labels yet. This matter can move to drafting review.</p>
                )}
              </Panel>

              <Panel title="Missing Information" icon={<FileWarning className="h-4 w-4" />}>
                {highlightedMatter.missing.length ? (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {highlightedMatter.missing.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Core facts are present. You can move this toward final draft assembly.</p>
                )}
              </Panel>
            </div>
          </section>

          <section className="space-y-6">
            <Panel title="Priority Review Queue" icon={<ShieldAlert className="h-4 w-4" />} padded>
              <div className="space-y-3">
                {priorityQueue.map((matter) => (
                  <div key={matter.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{matter.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{matter.stage}</p>
                      </div>
                      <RiskBadge risk={matter.risk} compact />
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{matter.nextStep}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {matter.createdAt ? new Date(matter.createdAt).toLocaleDateString() : "Unknown date"}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Recent Matter Activity" icon={<CheckCircle2 className="h-4 w-4" />} padded>
              <div className="space-y-3">
                {recentDocuments.map((matter) => (
                  <div key={matter.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{matter.title}</p>
                        <p className="text-sm text-slate-500">{matter.sections.length} sections tracked</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children, padded = false }) {
  return (
    <div className={`rounded-[24px] border border-slate-200 bg-white shadow-sm ${padded ? "p-5" : "p-4"}`}>
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InsightCard({ icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-600">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold leading-6 text-slate-900">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function RiskBadge({ risk, compact = false }) {
  const tone =
    risk === "high"
      ? "bg-red-50 text-red-700 border-red-200"
      : risk === "medium"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 font-medium capitalize ${tone} ${compact ? "text-xs" : "text-sm"}`}>
      {risk || "unknown"}
    </span>
  );
}
