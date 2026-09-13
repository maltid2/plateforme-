"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import Link from "next/link";
import { type ReactNode } from "react";
import { fadeUp, viewport } from "@/lib/motion";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative py-24 sm:py-32 ${className}`}>
      {children}
    </section>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  ...rest
}: { children: ReactNode; delay?: number; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={viewport}
      custom={delay / 0.08}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-acc-cyan">
      <span className="h-1.5 w-1.5 rounded-full bg-acc-cyan shadow-[0_0_10px_#8D7CFF]" />
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
      {children}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "ghost";
  className?: string;
  onClick?: () => void;
  icon?: ReactNode;
};

const EASE = "ease-[cubic-bezier(.32,.72,0,1)]";

export function Button({
  children,
  href = "#",
  variant = "primary",
  className = "",
  onClick,
  icon,
}: ButtonProps) {
  const hasIcon = !!icon;
  const base = `group relative inline-flex items-center justify-center gap-2.5 rounded-full text-sm font-semibold transition-all duration-[450ms] ${EASE} focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 active:scale-[0.98] ${
    hasIcon ? "py-1.5 pl-6 pr-1.5" : "px-6 py-3"
  }`;
  const styles =
    variant === "primary"
      ? "bg-gradient-to-b from-[#9a8cff] to-[#6b5cff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_44px_-18px_rgba(141,124,255,0.9)] hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_26px_56px_-18px_rgba(141,124,255,1)]"
      : "border border-white/10 bg-white/[0.03] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.06] hover:border-white/20";
  const iconWrap = variant === "primary" ? "bg-white/20" : "bg-white/[0.06]";
  return (
    <Link href={href} onClick={onClick} className={`${base} ${styles} ${className}`}>
      <span>{children}</span>
      {icon && (
        <span
          className={`grid h-8 w-8 flex-none place-items-center rounded-full ${iconWrap} transition-transform duration-[450ms] ${EASE} group-hover:translate-x-0.5 group-hover:-translate-y-px`}
        >
          {icon}
        </span>
      )}
    </Link>
  );
}

/**
 * Carte « double liseré » (Doppelrand) : coque extérieure fine + cœur interne
 * avec reflet en haut, pour un rendu matériel/premium. Halo violet au survol.
 */
export function GlowCard({
  children,
  className = "",
  glow = "violet",
}: {
  children: ReactNode;
  className?: string;
  glow?: "violet" | "green" | "cyan";
}) {
  const glowColor =
    glow === "green"
      ? "before:bg-acc-green/20"
      : glow === "cyan"
        ? "before:bg-acc-cyan/20"
        : "before:bg-acc-violet/20";
  return (
    <div
      className={`group relative rounded-[calc(1.25rem+6px)] border border-white/[0.06] bg-white/[0.02] p-1.5 backdrop-blur-sm before:absolute before:-inset-px before:-z-10 before:rounded-[inherit] before:opacity-0 before:blur-2xl before:transition-opacity before:duration-500 hover:before:opacity-100 ${glowColor}`}
    >
      <div
        className={`h-full rounded-2xl border border-white/[0.06] bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export { motion, viewport };
