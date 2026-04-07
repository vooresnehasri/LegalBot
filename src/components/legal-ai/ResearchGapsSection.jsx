import React from "react";
import { motion } from "framer-motion";
import { Globe, Languages, Eye, Shield } from "lucide-react";

const gaps = [
  {
    icon: Globe,
    title: "Cross-Domain Generalization",
    description:
      "Models trained on one legal domain struggle to transfer knowledge to others.",
  },
  {
    icon: Languages,
    title: "Multilingual Flexibility",
    description:
      "Limited support for non-English legal systems.",
  },
  {
    icon: Eye,
    title: "Explainability",
    description:
      "Deep learning models lack transparency in legal reasoning.",
  },
  {
    icon: Shield,
    title: "Bias & Fairness",
    description:
      "AI systems may inherit biases from historical legal data.",
  },
];

export default function ResearchGapsSection() {
  return (
    <section className="py-28 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-blue-400 font-medium text-sm tracking-wide uppercase">
            Open Questions
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
            Research Gaps
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Critical areas requiring further research and development in legal AI systems.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {gaps.map((gap, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-blue-400/50 hover:bg-white/15 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-colors">
                <gap.icon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-3 text-white">
                {gap.title}
              </h3>
              <p className="text-slate-300 leading-relaxed">
                {gap.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}