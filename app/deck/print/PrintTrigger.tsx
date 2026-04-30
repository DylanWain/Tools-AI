"use client";

import { useEffect } from "react";

/**
 * Auto-opens the browser's print dialog 600ms after the print page
 * mounts so visitors can save as PDF in one keystroke.
 */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
