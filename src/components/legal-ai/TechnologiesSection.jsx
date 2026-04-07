import React, { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Brain, MessageSquare, ChevronRight } from "lucide-react";

const technologies = [
  {
    id: "few-shot",
    icon: Zap,
    title: "Few-Shot Learning",
    description:
      "Enables models to learn effectively with limited labeled legal data.",
  },
  {
    id: "transformers",
    icon: Brain,
    title: "Transformer Models",
    description:
      "Capture contextual relationships in legal text using attention mechanisms.",
  },
  {
    id: "llms",
    icon: MessageSquare,
    title: "Large Language Models",
    description:
      "Provide generative AI capabilities for reasoning and legal drafting.",
  },
];

export default function TechnologiesSection() {
  const [active, setActive] = useState("few-shot");

  const current = technologies.find((t) => t.id === active);

  return (
    <section className="py-28 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-blue-600 font-medium text-sm tracking-wide uppercase">
            Core Technologies
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-4">
            Cutting-Edge Technologies
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Advanced AI approaches powering next-generation legal information extraction and reasoning.
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-3 mb-10 justify-center">
          {technologies.map((tech) => (
            <motion.button
              key={tech.id}
              onClick={() => setActive(tech.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                active === tech.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "bg-white border border-slate-200 text-slate-900 hover:border-blue-300"
              }`}
            >
              {tech.title}
            </motion.button>
          ))}
        </div>

        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-white to-slate-50 p-12 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-6">
            <current.icon className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            {current.title}
          </h3>
          <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed text-lg">
            {current.description}
          </p>
        </motion.div>
      </div>
    </section>
  );
}