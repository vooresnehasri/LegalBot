import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Database,
  Combine,
  Brain,
  BookOpen,
  Sparkles,
} from "lucide-react";

const directions = [
  {
    icon: Database,
    title: "Standardized Datasets",
    description:
      "Development of comprehensive benchmark datasets for consistent model evaluation and comparison.",
  },
  {
    icon: Combine,
    title: "Hybrid Systems",
    description:
      "Combining neural approaches with symbolic reasoning for more robust and interpretable models.",
  },
  {
    icon: Brain,
    title: "Knowledge-Aware AI",
    description:
      "Integration of legal ontologies and knowledge graphs to enhance reasoning capabilities.",
  },
  {
    icon: BookOpen,
    title: "Legal Ontologies",
    description:
      "Structured representation of legal concepts to improve model understanding and scalability.",
  },
  {
    icon: Sparkles,
    title: "Transparent Frameworks",
    description:
      "Building AI systems with built-in explainability for legal professionals and stakeholders.",
  },
];

export default function FutureDirectionsSection() {
  return (
    <section className="py-28 bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-blue-600 font-medium text-sm tracking-wide uppercase">
            Next Steps
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-4">
            Future Directions
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Emerging strategies and approaches to advance legal AI research and deployment.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {directions.map((direction, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group relative p-8 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-5 group-hover:bg-blue-200 transition-colors">
                  <direction.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">
                  {direction.title}
                </h3>
                <p className="text-slate-600 leading-relaxed group-hover:text-slate-700 transition-colors">
                  {direction.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}