"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@gather/shared/utils";

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

// Wrap any list render (`items.map(...)`) in these two to get a staggered
// fade+rise entrance for free — used across every list page (events,
// vendors, attendees, tasks, payments installments, team members) instead
// of adding motion props at each of those ~15 call sites individually.
export function StaggerList({ className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className={cn(className)}
      {...props}
    />
  );
}

export function StaggerItem({ className, ...props }: HTMLMotionProps<"div">) {
  return <motion.div variants={itemVariants} className={cn(className)} {...props} />;
}
