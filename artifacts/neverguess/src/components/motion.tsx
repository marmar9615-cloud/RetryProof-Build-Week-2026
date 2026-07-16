import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ReactNode } from "react";

/**
 * Reveal — a scroll-triggered fade-up wrapper. One restrained, repeatable
 * motion primitive used across the site so reveals feel consistent. Collapses
 * to a plain div under prefers-reduced-motion.
 */
const variants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      // Trigger as soon as a sliver is visible — the old -80px margin left
      // long sections invisible for crawlers, capture bots, and short
      // viewports where the threshold never crossed.
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
