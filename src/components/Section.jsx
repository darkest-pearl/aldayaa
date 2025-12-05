"use client";
import { motion } from 'framer-motion';

export default function Section({ children, className = '' }) {
  return (
    <motion.section
      className={`max-w-6xl w-full mx-auto px-3 sm:px-5 lg:px-8 py-8 md:py-16 lg:py-20 ${className}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      {children}
    </motion.section>
  );
}