"use client";

import { motion } from "motion/react";

// template.tsx (unlike layout.tsx) remounts on every navigation, giving a
// free per-route fade+rise transition without depending on Next 16's still
// experimental View Transitions flag.
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
