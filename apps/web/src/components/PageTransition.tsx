"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Subtle fade/slide on route change. Keyed by pathname so each navigation
 * re-mounts and re-animates. Respects the global reduced-motion preference via
 * the tiny travel distance (browsers honour prefers-reduced-motion on the CSS
 * side; framer keeps this gentle regardless).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
