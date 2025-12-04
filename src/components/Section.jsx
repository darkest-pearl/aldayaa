"use client";
import { motion } from 'framer-motion';

export default function Section({ children, className = '' }) {
  return (
    <motion.section
      className={`max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 lg:py-20 ${className}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      {children}
    </motion.section>
  );
}