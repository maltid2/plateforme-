"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowDownRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Counter } from "./Counter";
import { ease } from "@/lib/motion";

function RiskRing({ score, size = 108 }: { score: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#8D7CFF"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1, ease }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className="text-2xl font-bold">
            <Counter to={score} />
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
            / 100
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 220 64" className="h-16 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spgf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8D7CFF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#8D7CFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        fill="none"
        stroke="#8D7CFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease }}
      />
      <path d={`${path} L220,64 L0,64 Z`} fill="url(#spgf)" />
    </svg>
  );
}

type View = {
  label: string;
  score: number;
  delta: number;
  path: string;
};

const GLOBAL: View = {
  label: "Vue globale",
  score: 86,
  delta: 12,
  path: "M0,50 C24,44 34,20 56,24 C80,28 92,52 116,44 C140,36 150,10 176,16 C198,21 210,30 220,26",
};

const ASSETS: (View & {
  sev: string;
  color: string;
  asset: string;
  tag: string;
  tagCls: string;
})[] = [
  {
    sev: "Critique",
    color: "#F4576B",
    asset: "api.sentinelscope.dev",
    tag: "Nouveau",
    tagCls: "bg-acc-violet/15 text-acc-violet",
    label: "api.sentinelscope.dev",
    score: 41,
    delta: -18,
    path: "M0,20 C24,24 34,30 56,30 C80,30 92,26 116,34 C140,42 150,44 176,48 C198,51 210,54 220,56",
  },
  {
    sev: "Élevé",
    color: "#FF9715",
    asset: "staging-app.dev",
    tag: "En cours",
    tagCls: "bg-white/[0.06] text-muted",
    label: "staging-app.dev",
    score: 63,
    delta: -6,
    path: "M0,34 C24,30 34,38 56,36 C80,34 92,30 116,34 C140,38 150,42 176,40 C198,39 210,44 220,42",
  },
  {
    sev: "Élevé",
    color: "#FF9715",
    asset: "old-service.dev",
    tag: "Nouveau",
    tagCls: "bg-acc-violet/15 text-acc-violet",
    label: "old-service.dev",
    score: 58,
    delta: -9,
    path: "M0,28 C24,30 34,34 56,34 C80,34 92,38 116,38 C140,38 150,44 176,44 C198,44 210,48 220,48",
  },
  {
    sev: "Moyen",
    color: "#F5C451",
    asset: "cdn.sentinelscope.dev",
    tag: "Résolu",
    tagCls: "bg-acc-violet/15 text-acc-violet",
    label: "cdn.sentinelscope.dev",
    score: 79,
    delta: 4,
    path: "M0,44 C24,42 34,36 56,38 C80,40 92,30 116,30 C140,30 150,24 176,26 C198,27 210,24 220,22",
  },
];

export default function HeroDashboard() {
  const [sel, setSel] = useState(-1); // -1 = vue globale
  const view: View = sel < 0 ? GLOBAL : ASSETS[sel];
  const up = view.delta >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: 8, rotateY: -6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0 }}
      transition={{ duration: 1, ease, delay: 0.2 }}
      style={{ perspective: 1200 }}
      className="relative"
    >
      <div className="animate-float rounded-2xl border border-line bg-card/80 p-4 shadow-soft backdrop-blur-xl sm:p-5">
        {/* window bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            </span>
            <span className="ml-2 font-medium">Vue de la surface d&apos;attaque</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-acc-violet/10 px-2.5 py-1 text-[11px] font-semibold text-acc-violet">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acc-violet" />
            En direct
          </span>
        </div>

        {/* top cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-bg2/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-acc-violet" /> Score de risque
            </div>
            <div className="flex items-center gap-3">
              <RiskRing key={`ring-${sel}`} score={view.score} />
              <div className="text-xs text-muted">
                <div
                  className={`mb-1 flex items-center gap-1 font-semibold ${
                    up ? "text-acc-violet" : "text-sev-high"
                  }`}
                >
                  {up ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {up ? "+" : "−"}
                  {Math.abs(view.delta)} pts
                </div>
                cette semaine
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-bg2/60 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted">
              <Activity className="h-3.5 w-3.5 text-acc-violet" /> Tendance du risque
            </div>
            <Sparkline key={`spark-${sel}`} path={view.path} />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span className="truncate">{view.label}</span>
              <span>Aujourd&apos;hui</span>
            </div>
          </div>
        </div>

        {/* stat chips */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { n: <Counter to={1284} />, l: "Actifs découverts" },
            { n: <Counter to={23} />, l: "Vulnérabilités critiques", accent: "text-sev-critical" },
            { n: <Counter to={98.4} decimals={1} suffix="%" />, l: "Surveillé" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.12 }}
              className="rounded-xl border border-line bg-bg2/40 p-3"
            >
              <div className={`text-lg font-bold ${s.accent ?? ""}`}>{s.n}</div>
              <div className="text-[11px] text-muted">{s.l}</div>
            </motion.div>
          ))}
        </div>

        {/* alerts — tactiles : sélectionne un actif pour voir son score */}
        <div className="mt-3 rounded-xl border border-line bg-bg2/40 p-1">
          <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted/70">
            Touchez un actif pour l&apos;inspecter
          </div>
          {ASSETS.map((a, i) => {
            const active = sel === i;
            return (
              <motion.button
                type="button"
                key={a.asset}
                onClick={() => setSel(active ? -1 : i)}
                aria-pressed={active}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: 0.5 + i * 0.1 }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "bg-acc-violet/12 ring-1 ring-acc-violet/40"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: a.color, boxShadow: `0 0 10px ${a.color}` }}
                />
                <span className="flex-1 truncate font-mono text-[12.5px] text-ink/90">
                  {a.asset}
                </span>
                <span className="hidden text-[11px] text-muted sm:inline">{a.sev}</span>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${a.tagCls}`}>
                  {a.tag}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* floating chip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.1, ease }}
        className="absolute -right-3 -top-4 hidden rounded-xl border border-line bg-card/90 px-3 py-2 shadow-glow backdrop-blur-xl sm:block"
      >
        <div className="text-[11px] text-muted">Nouvel actif exposé</div>
        <div className="text-sm font-semibold text-acc-violet">admin-panel.dev</div>
      </motion.div>
    </motion.div>
  );
}
