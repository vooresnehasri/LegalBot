import React from 'react';
import { motion } from 'framer-motion';
import { Database, DollarSign, FileText, AlertTriangle } from 'lucide-react';

const challenges = [
  {
    icon: Database,
    title: 'Data Scarcity',
    description:
      'Conventional NLP models require large annotated datasets that are not always feasible in the legal domain.',
    color: 'blue',
  },
  {
    icon: DollarSign,
    title: 'High Labeling Costs',
    description:
      'Expert annotation of legal documents is expensive due to the specialized knowledge required.',
    color: 'amber',
  },
  {
    icon: FileText,
    title: 'Document Complexity',
    description:
      'Legal documents contain intricate language, domain-specific terminology, and complex structures.',
    color: 'purple',
  },
  {
    icon: AlertTriangle,
    title: 'Domain Specificity',
    description:
      'Generic AI models struggle with the unique characteristics of legal text and reasoning.',
    color: 'rose',
  },
];

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    border: 'border-blue-100',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'bg-amber-100 text-amber-600',
    border: 'border-amber-100',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    border: 'border-purple-100',
  },
  rose: {
    bg: 'bg-rose-50',
    icon: 'bg-rose-100 text-rose-600',
    border: 'border-rose-100',
  },
};

export default function ChallengesSection() {
  return (
    <section className="py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-blue-600 font-medium text-sm tracking-wide uppercase">
            The Problem
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-4">
            Key Challenges in Legal AI
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            The digitalization of legal information creates pressing demands for smart extraction systems,
            yet faces significant obstacles.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {challenges.map((challenge, index) => {
            const colors = colorClasses[challenge.color];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`group p-8 rounded-2xl ${colors.bg} border ${colors.border} hover:shadow-lg transition-all duration-300 relative overflow-hidden`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 bg-gradient-to-br from-current to-transparent transition-opacity duration-300" />
                <div className="relative">
                  <div className={`w-14 h-14 rounded-xl ${colors.icon} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <challenge.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">
                    {challenge.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed group-hover:text-slate-700 transition-colors">
                    {challenge.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}