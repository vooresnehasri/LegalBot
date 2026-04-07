import React from 'react';
import { motion } from 'framer-motion';
import { Tags, BookOpen, Gavel, FileSearch } from 'lucide-react';

const applications = [
  {
    icon: Tags,
    title: 'Named Entity Recognition',
    abbr: 'NER',
    description:
      'Automatically identify and classify legal entities such as parties, dates, jurisdictions, case citations, and statutory references.',
    metrics: [
      'Parties & Organizations',
      'Dates & Deadlines',
      'Legal Citations',
      'Jurisdictions',
    ],
  },
  {
    icon: BookOpen,
    title: 'Semantic Role Labeling',
    abbr: 'SRL',
    description:
      'Extract the semantic roles of entities in legal text, understanding who did what to whom under what circumstances.',
    metrics: [
      'Agent Identification',
      'Action Classification',
      'Circumstance Extraction',
      'Relationship Mapping',
    ],
  },
  {
    icon: Gavel,
    title: 'Judgment Prediction',
    abbr: 'JP',
    description:
      'Predict case outcomes based on facts, precedents, and legal arguments using historical judicial decisions.',
    metrics: [
      'Outcome Forecasting',
      'Risk Assessment',
      'Precedent Analysis',
      'Decision Support',
    ],
  },
  {
    icon: FileSearch,
    title: 'Attribute Extraction',
    abbr: 'AE',
    description:
      'Extract structured attributes from unstructured legal documents including contract terms, obligations, and conditions.',
    metrics: ['Contract Terms', 'Obligations', 'Conditions', 'Deadlines'],
  },
];

export default function ApplicationsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-blue-600 font-medium text-sm tracking-wide uppercase">
            Use Cases
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-4">
            Key Applications
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            These technologies enhance critical legal AI tasks, enabling
            automated information extraction at scale with unprecedented
            accuracy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {applications.map((app, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative bg-gradient-to-br from-slate-50 to-white rounded-2xl p-8 border border-slate-100 hover:shadow-xl hover:border-slate-200 transition-all duration-500"
            >
              <div className="absolute top-8 right-8 text-6xl font-bold text-slate-100 group-hover:text-blue-50 transition-colors">
                {app.abbr}
              </div>

              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/20">
                  <app.icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  {app.title}
                </h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {app.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {app.metrics.map((metric, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}