import { NextResponse } from "next/server";
import path from "path";
import { analyser, lireBoutique, normaliserDomaine, rechercher } from "@/lib/commerce/moteur";

// Lecture réseau + DNS (garde anti-SSRF) : runtime Node.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BOUTIQUES_MAX = 8;

// Même limiteur que l'audit : chaque requête fait lire jusqu'à 8 boutiques,
// on ne veut pas que l'outil serve à arroser des sites tiers.
const HITS = new Map();
const LIMITE = 30;
const FENETRE = 60 * 60 * 1000;
function ipOk(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < FENETRE);
  if (arr.length >= LIMITE) { HITS.set(ip, arr); return false; }
  arr.push(now); HITS.set(ip, arr); return true;
}

function garde() {
  const ssrf = __non_webpack_require__(path.join(process.cwd(), "audit-engine", "src", "lib", "ssrf-guard.js"));
  return (url) => ssrf.assertPublicTarget(url);
}

function domaines(liste) {
  const vus = new Set();
  for (const s of Array.isArray(liste) ? liste : []) {
    const d = normaliserDomaine(s);
    if (d) vus.add(d);
  }
  return [...vus].slice(0, BOUTIQUES_MAX);
}

export async function POST(req) {
  let corps;
  try { corps = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
  if (!ipOk(ip)) return NextResponse.json({ error: "Trop de recherches lancées. Réessayez dans un moment." }, { status: 429 });

  const boutiques = domaines(corps?.boutiques);
  if (!boutiques.length) return NextResponse.json({ error: "Indiquez au moins une boutique à interroger." }, { status: 400 });

  try {
    if (corps.action === "recherche") {
      const q = String(corps.requete || "").trim();
      if (q.length < 2) return NextResponse.json({ error: "Tapez le produit que vous cherchez." }, { status: 400 });
      return NextResponse.json(await rechercher(q, boutiques, garde()));
    }
    if (corps.action === "analyse") {
      const g = garde();
      const mienne = normaliserDomaine(corps.maBoutique);
      const [concurrents, maBoutique] = await Promise.all([
        Promise.all(boutiques.map((d) => lireBoutique(d, g))),
        mienne ? lireBoutique(mienne, g) : null,
      ]);
      return NextResponse.json(analyser(concurrents, maBoutique));
    }
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    console.error("[commerce] échec :", e && e.message ? e.message : e);
    return NextResponse.json({ error: "La recherche n'a pas pu aboutir. Réessayez." }, { status: 502 });
  }
}
