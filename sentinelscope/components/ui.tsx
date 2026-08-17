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
    <section id={id} className={`relative py-20 sm:py-28 ${className}`}>
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
      <span className="h-1.5 w-1.5 rounded-full bg-acc-cyan shadow-[0_0_10px_#57E6D1]" />
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

export function Button({
  children,
  href = "#",
  variant = "primary",
  className = "",
  onClick,
  icon,
}: ButtonProps) {
  const base =
    "group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60";
  const styles =
    variant === "primary"
      ? "bg-gradient-to-br from-acc-violet to-[#6b5cff] text-white shadow-[0_16px_40px_-16px_rgba(141,124,255,0.8)] hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-16px_rgba(141,124,255,0.9)]"
      : "border border-line bg-white/[0.03] text-ink hover:bg-white/[0.07] hover:border-white/20";
  return (
    <Link href={href} onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
      {icon}
    </Link>
  );
}

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
      className={`relative rounded-2xl border border-line bg-card/70 backdrop-blur-sm before:absolute before:-inset-px before:-z-10 before:rounded-2xl before:opacity-0 before:blur-2xl before:transition-opacity hover:before:opacity-100 ${glowColor} ${className}`}
    >
      {children}
    </div>
  );
}

export { motion, viewport };
