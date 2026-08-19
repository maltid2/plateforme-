"use client";

import { motion } from "framer-motion";
import { Activity, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Counter } from "./Counter";
import { ease } from "@/lib/motion";

function RiskRing({ score = 86, size = 108 }: { score?: number; size?: number }) {
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
          stroke="url(#ringg)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - score / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease }}
        />
        <defs>
          <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A7F36B" />
            <stop offset="1" stopColor="#57E6D1" />
          </linearGradient>
        </defs>
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

function Sparkline() {
  return (
    <svg viewBox="0 0 220 64" className="h-16 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8D7CFF" />
          <stop offset="1" stopColor="#57E6D1" />
        </linearGradient>
        <linearGradient id="spgf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#57E6D1" stopOpacity="0.22" />
          <stop offset="1" stopColor="#57E6D1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0,50 C24,44 34,20 56,24 C80,28 92,52 116,44 C140,36 150,10 176,16 C198,21 210,30 220,26"
        fill="none"
        stroke="url(#spg)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease }}
      />
      <path
        d="M0,50 C24,44 34,20 56,24 C80,28 92,52 116,44 C140,36 150,10 176,16 C198,21 210,30 220,26 L220,64 L0,64 Z"
        fill="url(#spgf)"
      />
    </svg>
  );
}

const ALERTS = [
  { sev: "Critique", color: "#F4576B", asset: "api.sentinelscope.dev", tag: "Nouveau", tagCls: "bg-acc-violet/15 text-acc-violet" },
  { sev: "Élevé", color: "#FF9715", asset: "staging-app.dev", tag: "En cours", tagCls: "bg-white/[0.06] text-muted" },
  { sev: "Élevé", color: "#FF9715", asset: "old-service.dev", tag: "Nouveau", tagCls: "bg-acc-violet/15 text-acc-violet" },
  { sev: "Moyen", color: "#F5C451", asset: "cdn.sentinelscope.dev", tag: "Résolu", tagCls: "bg-acc-green/15 text-acc-green" },
];

export default function HeroDashboard() {
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-acc-green/10 px-2.5 py-1 text-[11px] font-semibold text-acc-green">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acc-green" />
            En direct
          </span>
        </div>

        {/* top cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-bg2/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-acc-cyan" /> Score de risque
            </div>
            <div className="flex items-center gap-3">
              <RiskRing />
              <div className="text-xs text-muted">
                <div className="mb-1 flex items-center gap-1 font-semibold text-acc-green">
                  <ArrowUpRight className="h-3.5 w-3.5" /> +12 pts
                </div>
                cette semaine
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-bg2/60 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted">
              <Activity className="h-3.5 w-3.5 text-acc-violet" /> Tendance du risque
            </div>
            <Sparkline />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>il y a 30 j</span>
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

        {/* alerts */}
        <div className="mt-3 rounded-xl border border-line bg-bg2/40 p-1">
          {ALERTS.map((a, i) => (
            <motion.div
              key={a.asset}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]"
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
            </motion.div>
          ))}
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
        <div className="text-sm font-semibold text-acc-cyan">admin-panel.dev</div>
      </motion.div>
    </motion.div>
  );
}
