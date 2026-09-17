"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

type Phase = "idle" | "scanning" | "done" | "error";

type Sev = "high" | "medium" | "low" | "info";
type SectionFinding = {
  severity: Sev;
  message: string;
  recommendation?: string | null;
};
type Section = {
  name: string;
  status: "ok" | "warn" | "error";
  findings: SectionFinding[];
  more: number;
};
type Finding = { ok: boolean; label: string };
type Result = {
  host: string;
  score: number;
  grade: string;
  meaning?: string;
  findings: Finding[];
  sections?: Section[];
  reportHtml?: string;
};

const STEPS = [
  "Résolution du domaine",
  "Connexion sécurisée (TLS)",
  "En-têtes de sécurité",
  "Exposition & services",
  "Génération du rapport",
];

const CONSENT_KEY = "ss-audit-consent-v1";

// Adresse de contact affichée dans le pop-up « Aller plus loin ».
// Surchargée par NEXT_PUBLIC_CONTACT_EMAIL si définie dans Vercel.
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@sentrylescope.fr";

const gradeColor: Record<string, string> = {
  A: "#8D7CFF",
  B: "#8D7CFF",
  C: "#A78BFA",
  D: "#8B5CF6",
  F: "#A855F7",
};

// Gravité d'une alerte : libellé + couleur (rouge = vraiment grave).
const SEV_META: Record<Sev, { label: string; color: string; bg: string }> = {
  high: { label: "Élevé", color: "#F87171", bg: "rgba(248,113,113,0.14)" },
  medium: { label: "Moyen", color: "#F0A93B", bg: "rgba(240,169,59,0.14)" },
  low: { label: "Faible", color: "#A78BFA", bg: "rgba(167,139,250,0.16)" },
  info: { label: "Info", color: "#8B98A8", bg: "rgba(139,152,168,0.14)" },
};

// Verdict d'une section.
const STATUS_META: Record<
  Section["status"],
  { label: string; color: string; bg: string }
> = {
  ok: { label: "Conforme", color: "#5FD68A", bg: "rgba(95,214,138,0.14)" },
  warn: { label: "À corriger", color: "#F0A93B", bg: "rgba(240,169,59,0.14)" },
  error: { label: "Non vérifié", color: "#8B98A8", bg: "rgba(139,152,168,0.14)" },
};

/** Ouvre le rapport HTML complet dans un nouvel onglet (Blob URL, sans serveur). */
function openReport(html?: string) {
  if (!html) return;
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    const w = window.open(u, "_blank");
    if (!w) window.location.href = u;
  } catch {
    /* ignore */
  }
}

/** Anneau de score circulaire, cohérent avec le dashboard et le rapport. */
function ScoreRing({
  score,
  grade,
  size = 74,
}: {
  score: number;
  grade: string;
  size?: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = gradeColor[grade] || "#8B5CF6";
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
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
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, score)) / 100) }}
          transition={{ duration: 1, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center leading-none">
        <div className="text-center">
          <div className="js-score-num text-xl font-extrabold text-ink">{score}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted">/ 100</div>
        </div>
      </div>
    </div>
  );
}

export default function AuditForm({
  id,
  align = "start",
}: {
  id?: string;
  align?: "start" | "center";
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [host, setHost] = useState("");
  const [inputError, setInputError] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const pendingUrl = useRef<string | null>(null);
  const contactShown = useRef(false);

  // Ouvre automatiquement le pop-up de contact une seule fois, quelques
  // secondes après l'affichage du résultat (moment où l'intérêt est maximal).
  useEffect(() => {
    if (phase !== "done" || !result || contactShown.current) return;
    const t = setTimeout(() => {
      contactShown.current = true;
      setContactOpen(true);
    }, 2600);
    return () => clearTimeout(t);
  }, [phase, result]);

  // Animation premium à l'apparition du résultat (anime.js) : le score monte
  // de 0 à sa valeur et les lignes apparaissent en cascade. Repli sans effet
  // si la librairie ne se charge pas.
  useEffect(() => {
    if (phase !== "done" || !result) return;
    let stopped = false;
    (async () => {
      try {
        const { animate, stagger } = await import("animejs");
        if (stopped) return;
        const root = resultRef.current;
        if (!root) return;
        const numEl = root.querySelector<HTMLElement>(".js-score-num");
        if (numEl) {
          const obj = { v: 0 };
          animate(obj, {
            v: result.score,
            duration: 1000,
            ease: "out(3)",
            onUpdate: () => {
              numEl.textContent = String(Math.round(obj.v));
            },
          });
        }
        const rows = root.querySelectorAll(".audit-finding");
        if (rows.length) {
          animate(rows, {
            opacity: [0, 1],
            translateY: [8, 0],
            duration: 420,
            delay: stagger(55),
            ease: "out(2)",
          });
        }
      } catch {
        /* anime.js indisponible : le résultat s'affiche normalement */
      }
    })();
    return () => {
      stopped = true;
    };
  }, [phase, result]);

  const stopTimer = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  /** Lance réellement l'analyse (après acceptation de la décharge). */
  const doAudit = async (raw: string) => {
    setInputError(false);
    setErrMsg("");
    setResult(null);
    setHost(raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""));
    setPhase("scanning");
    setStep(0);

    const startedAt = Date.now();
    const MIN_LOADER_MS = 5200; // durée minimale d'affichage du loader
    stopTimer();
    timer.current = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 900);

    try {
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const j = await r.json();
      if (!r.ok) {
        stopTimer();
        setErrMsg(j?.error || "Une erreur est survenue pendant l'analyse.");
        setPhase("error");
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADER_MS) {
        await new Promise((res) => setTimeout(res, MIN_LOADER_MS - elapsed));
      }
      stopTimer();
      setResult(j as Result);
      setStep(STEPS.length);
      setPhase("done");
    } catch (err) {
      stopTimer();
      setErrMsg(
        "Impossible de contacter le service d'analyse. Réessayez dans un instant."
      );
      setPhase("error");
    }
  };

  const hasConsent = () => {
    try {
      return localStorage.getItem(CONSENT_KEY) === "1";
    } catch {
      return false;
    }
  };

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw || !raw.includes(".")) {
      setInputError(true);
      return;
    }
    // Décharge de responsabilité : à accepter avant toute analyse.
    if (!hasConsent()) {
      pendingUrl.current = raw;
      setConsentOpen(true);
      return;
    }
    doAudit(raw);
  };

  const acceptConsent = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setConsentOpen(false);
    const raw = pendingUrl.current;
    pendingUrl.current = null;
    if (raw) doAudit(raw);
  };

  const declineConsent = () => {
    pendingUrl.current = null;
    setConsentOpen(false);
  };

  const reset = () => {
    stopTimer();
    setPhase("idle");
    setHost("");
    setStep(0);
    setResult(null);
    setErrMsg("");
    setContactOpen(false);
    contactShown.current = false;
  };

  const sections = result?.sections;

  // Lien mailto pré-rempli avec le site audité et son score, pour transformer
  // le résultat en prise de contact (objectif : vendre la prestation).
  const contactHref = (() => {
    const subject = host
      ? `Audit de sécurité — ${host}`
      : "Audit de sécurité de mon site";
    const scoreLine =
      result && host
        ? `J'ai réalisé l'audit de ${host} sur SentinelScope (score ${result.score}/100, note ${result.grade}).`
        : "J'ai réalisé un audit sur SentinelScope.";
    const body = [
      "Bonjour,",
      "",
      scoreLine,
      "",
      "Je souhaite aller plus loin pour corriger les points détectés et sécuriser mon infrastructure. Pouvez-vous me recontacter ?",
      "",
      "Merci.",
    ].join("\n");
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  })();

  return (
    <div
      id={id}
      className={align === "center" ? "mx-auto w-full max-w-xl scroll-mt-28" : "w-full max-w-xl scroll-mt-28"}
    >
      <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setInputError(false);
            }}
            placeholder="votre-site.fr"
            aria-label="Adresse de votre site à auditer"
            aria-invalid={inputError}
            className={`h-[52px] w-full rounded-full border bg-white/[0.03] py-3.5 pl-11 pr-4 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 ${
              inputError ? "border-sev-critical/60" : "border-line focus:border-white/20"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={phase === "scanning"}
          className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-[#9a8cff] to-[#6b5cff] pl-7 pr-2 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_18px_44px_-18px_rgba(141,124,255,0.9)] transition-all duration-[450ms] ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 disabled:opacity-70"
        >
          {phase === "scanning" ? (
            <span className="inline-flex items-center gap-2 pr-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyse…
            </span>
          ) : (
            <>
              <span>Analyser mon site</span>
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/20 transition-transform duration-[450ms] ease-[cubic-bezier(.32,.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
                <ArrowRight className="h-4 w-4" />
              </span>
            </>
          )}
        </button>
      </form>

      <p
        className={`mt-3 text-sm ${inputError ? "text-sev-critical" : "text-muted"} ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {inputError
          ? "Entrez une adresse de site valide, par exemple votre-site.fr"
          : "Sans inscription · Audit non intrusif · Résultat en quelques minutes"}
      </p>

      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-5 overflow-hidden"
          >
            <div className="rounded-[20px] border border-white/[0.07] bg-card/70 p-5 text-left shadow-soft backdrop-blur-xl">
              {phase === "scanning" ? (
                <div>
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-acc-violet" />
                    Analyse de <span className="font-mono text-ink">{host}</span>
                  </div>
                  <div className="space-y-2.5">
                    {STEPS.map((s, i) => (
                      <div key={s} className="flex items-center gap-2.5 text-sm">
                        {i < step ? (
                          <CheckCircle2 className="h-4 w-4 flex-none text-acc-violet" />
                        ) : i === step ? (
                          <Loader2 className="h-4 w-4 flex-none animate-spin text-acc-violet" />
                        ) : (
                          <span className="h-4 w-4 flex-none rounded-full border border-line" />
                        )}
                        <span className={i <= step ? "text-ink/90" : "text-muted"}>
                          {s}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : phase === "error" ? (
                <div>
                  <div className="flex items-start gap-2.5 text-sm">
                    <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-sev-critical" />
                    <span className="text-ink">{errMsg}</span>
                  </div>
                  <button
                    onClick={reset}
                    className="mt-4 text-sm font-medium text-acc-violet transition-colors hover:text-ink"
                  >
                    Réessayer
                  </button>
                </div>
              ) : result ? (
                <div ref={resultRef}>
                  <div className="flex items-center gap-4">
                    <ScoreRing score={result.score} grade={result.grade} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-ink">
                          Note {result.grade}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: `${gradeColor[result.grade] || "#8B5CF6"}22`,
                            color: gradeColor[result.grade] || "#8B5CF6",
                          }}
                        >
                          {result.score}/100
                        </span>
                      </div>
                      {result.meaning && (
                        <div className="mt-1 text-sm text-ink/80">
                          {result.meaning}
                        </div>
                      )}
                      <div className="mt-1 truncate font-mono text-xs text-muted">
                        {result.host}
                      </div>
                    </div>
                  </div>

                  {/* Alertes classées par section, avec gravité */}
                  {sections && sections.length > 0 ? (
                    <div className="mt-5 divide-y divide-line rounded-2xl border border-line bg-white/[0.015]">
                      {sections.map((sec, i) => {
                        const st = STATUS_META[sec.status];
                        return (
                          <div key={i} className="audit-finding p-4 sm:px-5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-ink">
                                {sec.name}
                              </span>
                              <span
                                className="flex-none text-xs font-semibold"
                                style={{ color: st.color }}
                              >
                                {st.label}
                              </span>
                            </div>
                            {sec.findings.length > 0 && (
                              <ul className="mt-3 space-y-3">
                                {sec.findings.map((f, j) => {
                                  const sv = SEV_META[f.severity] || SEV_META.info;
                                  return (
                                    <li key={j} className="flex items-start gap-3">
                                      <span
                                        className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full"
                                        style={{ background: sv.color }}
                                        title={sv.label}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm text-ink/90">{f.message}</p>
                                        {f.recommendation && (
                                          <p className="mt-1 text-xs leading-relaxed text-muted">
                                            {f.recommendation}
                                          </p>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                                {sec.more > 0 && (
                                  <li className="pl-[18px] text-xs text-muted">
                                    +{sec.more} autre(s) — voir le rapport complet
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {result.findings.map((f, i) => (
                        <li key={i} className="audit-finding flex items-start gap-2.5 text-sm">
                          {f.ok ? (
                            <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-acc-violet" />
                          ) : (
                            <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-sev-high" />
                          )}
                          <span className={f.ok ? "text-ink/85" : "text-ink"}>
                            {f.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => openReport(result.reportHtml)}
                      disabled={!result.reportHtml}
                      className="inline-flex items-center gap-1.5 rounded-full bg-acc-violet/15 px-4 py-2 text-sm font-semibold text-acc-violet transition-colors hover:bg-acc-violet/25 disabled:opacity-50"
                    >
                      Voir le rapport complet
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setContactOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-white/20"
                    >
                      Aller plus loin
                    </button>
                    <button
                      onClick={reset}
                      className="text-sm font-medium text-muted transition-colors hover:text-ink"
                    >
                      Analyser un autre site
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-muted">
                    Audit réel et non intrusif — le rapport complet détaille chaque
                    point, pourquoi le corriger et l&apos;état des fichiers exposés.
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-up de décharge — à accepter avant toute analyse */}
      {consentOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Avant de lancer l'analyse"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={declineConsent}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              className="relative w-full max-w-lg rounded-[20px] border border-white/[0.07] bg-card p-6 shadow-soft"
            >
              <button
                onClick={declineConsent}
                aria-label="Fermer"
                className="absolute right-4 top-4 text-muted transition-colors hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-acc-violet/15">
                  <ShieldAlert className="h-5 w-5 text-acc-violet" />
                </span>
                <h3 className="text-lg font-bold text-ink">
                  Avant de lancer l&apos;analyse
                </h3>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                <p>
                  Vous devez être <strong className="text-ink">propriétaire</strong> du
                  site analysé, ou disposer d&apos;une{" "}
                  <strong className="text-ink">autorisation explicite</strong> pour
                  l&apos;auditer.
                </p>
                <p>
                  SentinelScope réalise un audit non intrusif, à titre informatif, et{" "}
                  <strong className="text-ink">
                    décline toute responsabilité
                  </strong>{" "}
                  quant à l&apos;usage des résultats ou à une analyse effectuée sans
                  autorisation.
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={declineConsent}
                  className="rounded-full border border-line bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-white/20"
                >
                  Annuler
                </button>
                <button
                  onClick={acceptConsent}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-acc-violet to-[#6b5cff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_40px_-16px_rgba(141,124,255,0.8)] transition-all hover:-translate-y-0.5"
                >
                  J&apos;accepte et je lance l&apos;analyse
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* Pop-up « Aller plus loin » — prise de contact après le résultat */}
      {contactOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Aller plus loin avec un expert"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setContactOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              className="relative w-full max-w-lg rounded-[20px] border border-white/[0.07] bg-card p-6 shadow-soft"
            >
              <button
                onClick={() => setContactOpen(false)}
                aria-label="Fermer"
                className="absolute right-4 top-4 text-muted transition-colors hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-acc-violet/15">
                  <ShieldCheck className="h-5 w-5 text-acc-violet" />
                </span>
                <h3 className="text-lg font-bold text-ink">
                  Passez à l&apos;action
                </h3>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                <p>
                  Cet audit vous a montré <strong className="text-ink">où</strong>{" "}
                  votre site est exposé.{" "}
                  {host ? (
                    <>
                      L&apos;étape suivante&nbsp;: <strong className="text-ink">corriger</strong>{" "}
                      les points détectés sur{" "}
                      <span className="font-mono text-ink">{host}</span> et sécuriser
                      votre infrastructure durablement.
                    </>
                  ) : (
                    <>
                      L&apos;étape suivante&nbsp;: <strong className="text-ink">corriger</strong>{" "}
                      les points détectés et sécuriser votre infrastructure durablement.
                    </>
                  )}
                </p>
                <p>
                  Décrivez votre besoin en un message&nbsp;: je vous recontacte pour
                  poursuivre l&apos;audit et mettre en place les correctifs.
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setContactOpen(false)}
                  className="rounded-full border border-line bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-white/20"
                >
                  Plus tard
                </button>
                <a
                  href={contactHref}
                  onClick={() => setContactOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-acc-violet to-[#6b5cff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_40px_-16px_rgba(141,124,255,0.8)] transition-all hover:-translate-y-0.5"
                >
                  <Mail className="h-4 w-4" />
                  Me faire recontacter
                </a>
              </div>

              <p className="mt-4 text-center text-xs text-muted">
                Ou écrivez directement à{" "}
                <a
                  href={contactHref}
                  className="font-medium text-acc-violet hover:text-ink"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
}
