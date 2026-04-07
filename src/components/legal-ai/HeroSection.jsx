import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, FileText, MessageSquare } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-102px)] overflow-hidden bg-[#0a1f56] text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_32%,rgba(12,64,205,0.38),transparent_32%),radial-gradient(circle_at_78%_82%,rgba(126,82,255,0.30),transparent_35%),linear-gradient(118deg,#05112b_0%,#142f70_43%,#223f95_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_50%,rgba(2,8,23,0.52),transparent_28%)]" />
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "74px 74px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-102px)] w-full max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-amber-300" />
          AI-Powered Legal Intelligence Platform
        </div>

        <h1 className="text-7xl font-extrabold tracking-tight md:text-8xl">LexIntel</h1>

        <p className="mt-8 max-w-5xl text-2xl leading-relaxed text-slate-200 md:text-3xl">
          Transform legal workflows with cutting-edge AI. Generate documents, analyze risks,
          predict case outcomes, and access precedents all in one intelligent platform.
        </p>

        <div className="mt-14 flex w-full max-w-3xl flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/DocumentGenerator"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-7 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-400 sm:w-auto"
          >
            <FileText className="h-5 w-5" />
            Start Creating Documents
          </Link>

          <Link
            to="/LegalChatbot"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-4 text-lg font-semibold text-white transition hover:bg-white/20 sm:w-auto"
          >
            <MessageSquare className="h-5 w-5" />
            Chat with Legal AI
          </Link>
        </div>
      </div>
    </section>
  );
}
