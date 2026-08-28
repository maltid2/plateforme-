"use client";

import { MotionConfig } from "framer-motion";

/**
 * Fournit un contexte Framer Motion global qui respecte le réglage système
 * « réduire les animations » (accessibilité) sans changer les animations
 * elles-mêmes lorsque l'utilisateur ne l'a pas demandé.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
