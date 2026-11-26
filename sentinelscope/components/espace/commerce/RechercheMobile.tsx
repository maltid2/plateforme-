"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Search, Settings2 } from "lucide-react";

/**
 * La recherche produit sans 3D : téléphone, ou navigateur qui n'affiche pas
 * WebGL. Même moteur (/api/commerce), même liste de boutiques mémorisée que
 * la scène — un client qui a réglé ses concurrents sur ordinateur les
 * retrouve sur son téléphone du même navigateur, et inversement.
 */

const CLE = "ss-veille-boutiques";
const EXEMPLE = { requete: "merino socks", boutiques: ["allbirds.com", "shop.bombas.com", "www.taylorstitch.com"] };

type Boutique = { domaine: string; nom: string; statut: string; message: string | null };
type Resultat = { titre: string; prix: number; prixMax: number; remise: number; dispo: boolean; url: string; pertinence: number; boutique: string; devise: string | null };
type Indice = { texte: string; fort: boolean };
type Piste = { titre: string; prixMedian: number; boutiques: number; indices: Indice[]; exemples: { boutique: string; prix: number; url: string }[] };
type Etat =
  | { type: "vide" }
  | { type: "recherche"; requete: string; resultats: Resultat[]; boutiques: Boutique[]; devises: string[] }
  | { type: "analyse"; pistes: Piste[]; boutiques: Boutique[]; devises: string[]; lus: number };

const SYMB: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
const prix = (v: number, d?: string | null) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + (d ? " " + (SYMB[d] || d) : "");

export default function RechercheMobile() {
  const [requete, setRequete] = useState("");
  const [liste, setListe] = useState("");
  const [mienne, setMienne] = useState("");
  const [reglages, setReglages] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");
  const [etat, setEtat] = useState<Etat>({ type: "vide" });

  useEffect(() => {
    try {
      const m = JSON.parse(localStorage.getItem(CLE) || "null");
      if (m) { setListe((m.liste || []).join("\n")); setMienne(m.mienne || ""); }
      else setReglages(true);   // première visite : on ouvre la liste, sans elle rien ne marche
    } catch { setReglages(true); }
  }, []);

  const boutiques = (texte = liste) => texte.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8);

  async function lancer(action: "recherche" | "analyse", q = requete, texte = liste) {
    const bs = boutiques(texte);
    if (!bs.length) { setReglages(true); setMessage("Indiquez d'abord les boutiques à interroger, une par ligne."); return; }
    if (action === "recherche" && q.trim().length < 2) { setMessage("Tapez le produit que vous cherchez."); return; }
    try { localStorage.setItem(CLE, JSON.stringify({ liste: bs, mienne: mienne.trim() })); } catch { /* stockage indisponible */ }
    setOccupe(true); setReglages(false);
    setMessage(action === "recherche" ? `Recherche dans ${bs.length} boutique${bs.length > 1 ? "s" : ""}…` : `Lecture de ${bs.length} catalogue${bs.length > 1 ? "s" : ""}…`);
    try {
      const r = await fetch("/api/commerce", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, requete: q.trim(), boutiques: bs, maBoutique: mienne.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setMessage(d.error || "La recherche a échoué."); return; }
      setMessage("");
      setEtat(action === "recherche"
        ? { type: "recherche", requete: d.requete, resultats: d.resultats, boutiques: d.boutiques, devises: d.resume.devises }
        : { type: "analyse", pistes: d.pistes, boutiques: d.boutiques.filter((b: Boutique & { mienne?: boolean }) => !b.mienne), devises: d.devises, lus: d.produitsLus });
    } catch {
      setMessage("Le service ne répond pas. Réessayez dans un instant.");
    } finally {
      setOccupe(false);
    }
  }

  const exemple = () => {
    const texte = EXEMPLE.boutiques.join("\n");
    setListe(texte); setRequete(EXEMPLE.requete);
    lancer("recherche", EXEMPLE.requete, texte);
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); lancer("recherche"); }} className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Produit à chercher</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search" value={requete} onChange={(e) => setRequete(e.target.value)} maxLength={120}
            placeholder="Quel produit cherchez-vous ?"
            className="w-full rounded-xl border border-line bg-bg2 py-3 pl-10 pr-3 text-[15px] outline-none focus:border-acc-violet/60"
          />
        </label>
        <button type="submit" disabled={occupe} className="rounded-xl bg-acc-violet px-4 text-sm font-semibold text-[#0B0B12] disabled:opacity-60">
          {occupe ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Recherche en cours" /> : "Chercher"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => setReglages((v) => !v)} aria-expanded={reglages}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-muted">
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> Boutiques ({boutiques().length})
        </button>
        <button type="button" onClick={() => lancer("analyse")} disabled={occupe} className="rounded-full border border-line px-3 py-1.5 text-muted">
          Ce qu&apos;ils vendent et pas moi
        </button>
        <button type="button" onClick={exemple} disabled={occupe} className="rounded-full border border-line px-3 py-1.5 text-muted">
          Essayer un exemple
        </button>
      </div>

      {reglages && (
        <div className="mt-3 grid gap-3 rounded-2xl border border-line bg-bg2 p-4">
          <label className="grid gap-1.5 text-xs text-muted">
            Vos concurrents, une boutique Shopify par ligne (8 au plus)
            <textarea value={liste} onChange={(e) => setListe(e.target.value)} rows={4}
              placeholder={"boutique-concurrente.fr\nautre-boutique.com"}
              className="rounded-xl border border-line bg-bg p-3 font-mono text-[13px] text-ink outline-none focus:border-acc-violet/60" />
          </label>
          <label className="grid gap-1.5 text-xs text-muted">
            Votre boutique (facultatif)
            <input value={mienne} onChange={(e) => setMienne(e.target.value)} placeholder="votre-boutique.fr"
              className="rounded-xl border border-line bg-bg p-3 text-[14px] text-ink outline-none focus:border-acc-violet/60" />
          </label>
        </div>
      )}

      <p role="status" className="mt-3 min-h-[1.25rem] text-sm text-muted">{message}</p>

      {etat.type !== "vide" && <Statuts boutiques={etat.boutiques} />}
      {etat.type === "recherche" && <Resultats etat={etat} />}
      {etat.type === "analyse" && <Pistes etat={etat} />}
      {etat.type === "vide" && (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm leading-relaxed text-muted">
          Tapez un produit : le moteur le cherche dans la vitrine publique de chaque boutique de votre liste,
          et vous rend prix, stock et promotions. Sur grand écran, les résultats se parcourent en 3D.
        </p>
      )}
    </div>
  );
}

function Statuts({ boutiques }: { boutiques: Boutique[] }) {
  const ko = boutiques.filter((b) => b.statut !== "ok");
  if (!ko.length) return null;
  return (
    <ul className="mt-2 grid gap-1 text-xs text-[#FFD166]">
      {ko.map((b) => <li key={b.domaine}><b className="font-semibold">{b.domaine}</b> : {b.message}</li>)}
    </ul>
  );
}

function Resultats({ etat }: { etat: Extract<Etat, { type: "recherche" }> }) {
  const r = [...etat.resultats].sort((a, b) => Number(b.pertinence >= 0.5) - Number(a.pertinence >= 0.5) || a.prix - b.prix);
  const devise = etat.devises.length === 1 ? etat.devises[0] : null;
  const ps = r.map((x) => x.prix).sort((a, b) => a - b);
  const med = ps.length ? (ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2) : 0;
  return (
    <section className="mt-4" aria-label="Résultats">
      <h2 className="text-lg font-semibold">« {etat.requete} »</h2>
      {devise && r.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[[prix(ps[0], devise), "le moins cher", "text-sev-low"], [prix(Math.round(med * 100) / 100, devise), "médian", "text-ink"],
            [`${r.filter((x) => x.dispo).length}/${r.length}`, "en stock", "text-acc-violet"], [`${r.filter((x) => x.remise >= 0.05).length}`, "en promo", "text-sev-high"]]
            .map(([v, l, c]) => (
              <div key={l} className="rounded-xl border border-line bg-card px-1 py-2">
                <div className={`text-[15px] font-bold ${c}`}>{v}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">{l}</div>
              </div>
            ))}
        </div>
      )}
      {etat.devises.length > 1 && (
        <p className="mt-3 text-xs text-[#FFD166]">Devises différentes : les prix sont affichés tels que chaque boutique les publie, sans conversion.</p>
      )}
      <ul className="mt-3 grid gap-2">
        {r.map((x) => (
          <li key={x.url}>
            <a href={x.url} target="_blank" rel="noopener noreferrer nofollow"
              className="flex items-start justify-between gap-3 rounded-xl border border-line bg-card p-3 active:bg-bg2">
              <span className="min-w-0">
                <span className="block text-[14px] font-medium leading-snug">{x.titre}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  {x.boutique}
                  {!x.dispo && <Tag>rupture</Tag>}
                  {x.remise >= 0.05 && <Tag ton="promo">−{Math.round(x.remise * 100)} %</Tag>}
                  {x.pertinence < 0.5 && <Tag>approchant</Tag>}
                </span>
              </span>
              <span className="flex flex-none items-center gap-1 font-mono text-[13px]">
                {prix(x.prix, x.devise)} <ArrowUpRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              </span>
            </a>
          </li>
        ))}
      </ul>
      {!r.length && <p className="mt-3 text-sm text-muted">Aucun résultat dans ces boutiques.</p>}
    </section>
  );
}

function Pistes({ etat }: { etat: Extract<Etat, { type: "analyse" }> }) {
  const devise = etat.devises.length === 1 ? etat.devises[0] : null;
  return (
    <section className="mt-4" aria-label="Pistes">
      <h2 className="text-lg font-semibold">Ce qu&apos;ils vendent, et pas vous</h2>
      <p className="mt-1 text-xs text-muted">{etat.lus} produits lus · {etat.pistes.length} pistes, par force des indices</p>
      <ul className="mt-3 grid gap-2">
        {etat.pistes.map((p) => (
          <li key={p.titre + p.prixMedian} className="rounded-xl border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[14px] font-medium leading-snug">{p.titre}</span>
              <span className="flex-none font-mono text-[13px]">{prix(p.prixMedian, devise)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.indices.map((i) => <Tag key={i.texte} ton={i.fort ? "fort" : undefined}>{i.texte}</Tag>)}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
              {p.exemples.slice(0, 3).map((e) => (
                <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="text-acc-violet">
                  {e.boutique} ↗
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-xl border border-dashed border-[#FFD166]/40 p-3 text-xs text-muted">
        <b className="text-[#FFD166]">Pas de ventes affichées.</b> Aucune boutique ne publie ses volumes : ce sont des indices
        relevés sur les vitrines publiques, pas une demande mesurée.
      </p>
    </section>
  );
}

function Tag({ children, ton }: { children: React.ReactNode; ton?: "promo" | "fort" }) {
  const c = ton === "promo" ? "border-sev-high/40 text-sev-high" : ton === "fort" ? "border-sev-low/40 text-sev-low" : "border-line text-muted";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${c}`}>{children}</span>;
}

