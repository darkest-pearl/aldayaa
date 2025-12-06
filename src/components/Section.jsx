"use client";
import { motion } from 'framer-motion';

export default function Section({ children, className = '' }) {
  return (
    <motion.section
      className={`site-container py-10 md:py-16 ${className}`}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
    }}

    >
      {children}
    </motion.section>
  );
}