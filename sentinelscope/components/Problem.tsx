"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Eye, X } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import { viewport } from "@/lib/motion";

type Risk = "safe" | "medium" | "high" | "unknown";

type Node = {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: string;
  check: string;
  risk: Risk;
};

// Les 6 dimensions réellement analysées par SentinelScope à partir de l'URL
// saisie, disposées autour du site — c'est ce qui alimente le rapport.
const NODES: Node[] = [
  { id: "core", x: 50, y: 50, label: "votre-site.fr", kind: "Site analysé", check: "L'adresse que vous saisissez", risk: "safe" },
  { id: "ssl", x: 20, y: 22, label: "SSL / TLS", kind: "Connexion sécurisée", check: "Certificat valide et chiffrement à jour", risk: "safe" },
  { id: "headers", x: 82, y: 28, label: "En-têtes", kind: "Protection du site", check: "HSTS, CSP, X-Frame-Options…", risk: "medium" },
  { id: "files", x: 15, y: 72, label: "Fichiers exposés", kind: "Fichiers privés", check: ".env, .git, sauvegardes accessibles", risk: "high" },
  { id: "reputation", x: 85, y: 70, label: "Réputation", kind: "Réputation en ligne", check: "Listes noires et signalements", risk: "safe" },
  { id: "cve", x: 50, y: 13, label: "Failles (CVE)", kind: "Vulnérabilités connues", check: "Technologies obsolètes ou vulnérables", risk: "medium" },
  { id: "rgpd", x: 50, y: 88, label: "RGPD", kind: "Protection des données", check: "Cookies et consentement (RGPD)", risk: "medium" },
];

const EDGES: [string, string][] = [
  ["core", "ssl"],
  ["core", "headers"],
  ["core", "files"],
  ["core", "reputation"],
  ["core", "cve"],
  ["core", "rgpd"],
];

const RISK_META: Record<Risk, { color: string; label: string }> = {
  safe: { color: "#8D7CFF", label: "Risque faible" },
  medium: { color: "#A78BFA", label: "Risque moyen" },
  high: { color: "#A855F7", label: "Risque élevé" },
  unknown: { color: "#8B98A8", label: "Non classé" },
};

export default function Problem() {
  const [dismissed, setDismissed] = useState(false);
  const [solved, setSolved] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section id="problem" className="relative py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2">
        {/* copy */}
        <Reveal>
          <SectionLabel>L&apos;angle mort</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Votre surface d'attaque change{" "}
            <span className="text-gradient-violet">chaque jour.</span>
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Entrez l&apos;adresse de votre site : SentinelScope analyse votre
            connexion, vos en-têtes de sécurité, vos fichiers exposés, votre
            réputation, les failles connues et le RGPD — puis vous remet un
            rapport clair de ce qui est exposé.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {(
              [
                ["safe", "Risque faible"],
                ["medium", "Risque moyen"],
                ["high", "Risque élevé"],
                ["unknown", "Non classé"],
              ] as [Risk, string][]
            ).map(([r, l]) => (
              <span key={r} className="inline-flex items-center gap-2 text-sm text-muted">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: RISK_META[r].color }}
                />
                {l}
              </span>
            ))}
          </div>
        </Reveal>

        {/* interactive asset map */}
        <Reveal delay={0.15}>
          <div className="relative aspect-square w-full max-w-lg rounded-2xl border border-line bg-card/50 p-4 shadow-soft backdrop-blur-sm">
            <div className="absolute inset-0 rounded-2xl bg-grid-fade opacity-40" />
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-xs text-muted">
              <Eye className="h-3.5 w-3.5 text-acc-violet" /> Analyse de votre site en direct
            </div>

            <svg viewBox="0 0 100 100" className="relative h-full w-full overflow-visible">
              {EDGES.map(([a, b]) => {
                const na = NODES.find((n) => n.id === a)!;
                const nb = NODES.find((n) => n.id === b)!;
                return (
                  <motion.line
                    key={`${a}-${b}`}
                    x1={na.x}
                    y1={na.y}
                    x2={nb.x}
                    y2={nb.y}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={viewport}
                    transition={{ duration: 1, delay: 0.2 }}
                  />
                );
              })}
              {NODES.map((n, i) => {
                const solvedHere = solved && n.id === "files";
                const risk: Risk = solvedHere ? "safe" : n.risk;
                const color = RISK_META[risk].color;
                const pulse = (risk === "high" || risk === "medium") && !solvedHere;
                return (
                  <g
                    key={n.id}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {pulse && (
                      <motion.circle
                        cx={n.x}
                        cy={n.y}
                        r={n.id === "core" ? 5 : 3.4}
                        fill="none"
                        stroke={color}
                        strokeWidth="0.5"
                        initial={{ scale: 1, opacity: 0.7 }}
                        animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                        style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                      />
                    )}
                    {/* invisible larger hit area */}
                    <circle cx={n.x} cy={n.y} r={6} fill="transparent" />
                    <motion.circle
                      cx={n.x}
                      cy={n.y}
                      r={n.id === "core" ? 4.2 : hovered === n.id ? 3.4 : 2.6}
                      fill={color}
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={viewport}
                      transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
                      style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* asset labels */}
            {NODES.filter((n) => n.id !== "core").map((n) => (
              <span
                key={n.id}
                className="pointer-events-none absolute -translate-x-1/2 translate-y-2 whitespace-nowrap font-mono text-[9px] text-muted"
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                {n.label}
              </span>
            ))}

            {/* hover tooltip */}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  key={hovered}
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[140%] rounded-lg border border-line bg-bg2/95 px-3 py-2 shadow-glow backdrop-blur-xl"
                  style={{
                    left: `${NODES.find((n) => n.id === hovered)!.x}%`,
                    top: `${NODES.find((n) => n.id === hovered)!.y}%`,
                  }}
                >
                  {(() => {
                    const n = NODES.find((x) => x.id === hovered)!;
                    const solvedHere = solved && n.id === "files";
                    const risk = solvedHere ? "safe" : n.risk;
                    return (
                      <>
                        <div className="text-[11px] font-semibold text-ink">{n.kind}</div>
                        <div className="mt-0.5 text-[10px] text-muted">{n.check}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: RISK_META[risk].color }}
                          />
                          {RISK_META[risk].label}
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* popup */}
            <AnimatePresence>
              {!dismissed && !solved && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.4 }}
                  className="absolute bottom-4 left-4 right-4 z-30 rounded-xl border border-sev-critical/30 bg-bg2/95 p-3.5 shadow-glow backdrop-blur-xl"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg bg-sev-critical/15 text-sev-critical">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">
                        Problème détecté dans votre rapport
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-muted">
                        fichier .env accessible publiquement
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setSolved(true)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-acc-green/15 px-3 py-2 text-xs font-semibold text-acc-green transition-colors hover:bg-acc-green/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-green/50"
                    >
                      <Check className="h-3.5 w-3.5" /> Résoudre
                    </button>
                    <button
                      onClick={() => setDismissed(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-white/[0.1] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      <X className="h-3.5 w-3.5" /> Ignorer
                    </button>
                  </div>
                </motion.div>
              )}
              {solved && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-4 left-4 right-4 z-30 flex items-center gap-2.5 rounded-xl border border-acc-green/30 bg-bg2/95 p-3.5 text-sm font-semibold text-acc-green shadow-glow-green backdrop-blur-xl"
                >
                  <Check className="h-4 w-4" /> Exposition corrigée et vérifiée.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
