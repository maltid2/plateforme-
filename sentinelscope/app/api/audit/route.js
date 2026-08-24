import { NextResponse } from "next/server";
import path from "path";

// Le moteur fait du TLS/TCP/DNS natif : runtime Node obligatoire (pas Edge).
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// On charge le moteur d'audit avec le require natif de Node (pas le bundler
// webpack de Next), depuis les fichiers réels de `audit-engine/`. Cela évite
// tout problème d'empaquetage d'un module CommonJS natif. Les fichiers sont
// inclus dans la fonction serverless via `outputFileTracingIncludes`
// (voir next.config.mjs).
// `__non_webpack_require__` est remplacé par le require natif de Node au
// runtime (webpack ne l'analyse pas), ce qui charge les vrais fichiers.
function engineDir() {
  return path.join(process.cwd(), "audit-engine", "src");
}

// Limiteur de débit simple (best-effort, par instance serverless).
const HITS = new Map();
const LIMIT = 8;
const WINDOW = 60 * 60 * 1000;
function ipOk(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW);
  if (arr.length >= LIMIT) {
    HITS.set(ip, arr);
    return false;
  }
  arr.push(now);
  HITS.set(ip, arr);
  return true;
}

const SEV_RANK = { high: 3, medium: 2, low: 1, info: 0 };

/** Construit un aperçu lisible : les problèmes majeurs + quelques contrôles OK. */
function buildPreview(report) {
  const rows = [];
  const all = [];
  for (const m of report.modules || []) {
    for (const f of m.findings || []) all.push(f);
  }
  all.sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));
  for (const f of all.slice(0, 4)) {
    rows.push({ ok: false, label: f.message || f.id || "Point à corriger" });
  }
  for (const m of report.modules || []) {
    if (rows.length >= 6) break;
    if ((m.findings || []).length === 0 && !m.error) {
      rows.push({ ok: true, label: (m.name || "Contrôle") + " — aucun problème détecté" });
    }
  }
  if (rows.length === 0) rows.push({ ok: true, label: "Aucune anomalie majeure détectée" });
  return rows.slice(0, 6);
}

export async function POST(req) {
 try {
  const dir = engineDir();
  const engine = __non_webpack_require__(path.join(dir, "index.js"));
  const reportGen = __non_webpack_require__(path.join(dir, "report", "generator.js"));
  const ssrf = __non_webpack_require__(path.join(dir, "lib", "ssrf-guard.js"));

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const raw = body && body.url ? String(body.url).trim() : "";
  if (!raw) return NextResponse.json({ error: "URL manquante." }, { status: 400 });

  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!ipOk(ip)) {
    return NextResponse.json(
      { error: "Trop d'analyses lancées. Réessayez dans un moment." },
      { status: 429 }
    );
  }

  let url;
  try {
    url = engine.normalizeUrl(raw);
  } catch {
    return NextResponse.json({ error: "Adresse de site invalide." }, { status: 400 });
  }

  // Garde anti-SSRF : refuse les cibles internes/privées.
  const guard = await ssrf.assertPublicTarget(url);
  if (!guard.ok) {
    return NextResponse.json(
      { error: "Cible refusée : " + guard.reason },
      { status: 400 }
    );
  }

  let report;
  try {
    report = await engine.audit(url, { timeout: 15000 });
  } catch (e) {
    return NextResponse.json(
      { error: "Audit impossible : " + (e && e.message ? e.message : "erreur inconnue") },
      { status: 500 }
    );
  }

  let reportHtml = "";
  try {
    reportHtml = reportGen.buildHtml(report);
  } catch {
    reportHtml = "";
  }

  let host = raw;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}

  return NextResponse.json({
    host,
    score: report.scoring.score,
    grade: report.scoring.letter,
    meaning: report.scoring.meaning,
    findingsSummary: report.scoring.findingsSummary,
    findings: buildPreview(report),
    reportHtml,
  });
 } catch (e) {
  return NextResponse.json(
    { error: "Service d'analyse momentanément indisponible. Réessayez dans un instant." },
    { status: 500 }
  );
 }
}
