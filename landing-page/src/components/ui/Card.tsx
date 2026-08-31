import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function Card({ children, className = '', delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ y: -3, boxShadow: '0 8px 32px rgba(26, 31, 54, 0.13)', borderColor: 'rgba(196, 163, 90, 0.35)' }}
      className={`card p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
