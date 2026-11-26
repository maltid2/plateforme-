/**
 * Lecture d'un export Genetec (.csv ou .xlsx), avec le moteur de
 * Cartographie Réseau v3.2 (colonnes reconnues en français ou en anglais).
 * Inventaire matériel → unités ; configuration des caméras → flux et débits.
 * Un nouvel import du même fichier remplace l'ancien ; un autre fichier s'ajoute.
 */
import "./releve/carto-core.js";
import type { Genetec, UniteGenetec } from "./genetec.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const C = (globalThis as any).CartoCore;

export const lignesCsv = (texte: string): string[][] => C.parseCsvText(texte.replace(/^﻿/, ""));

export function lireGenetec(tableaux: string[][][], source: string, avant?: Genetec | null): { genetec: Genetec; msg: string } {
  const g: Genetec = {
    sources: (avant?.sources ?? []).filter((s) => s.nom !== source),
    unites: (avant?.unites ?? []).filter((u) => u.source !== source),
    flux: (avant?.flux ?? []).filter((f) => f.source !== source),
  };
  const date = new Date().toISOString();
  let unites = 0, flux = 0;
  for (const rows of tableaux) {
    if (!rows.length) continue;
    if (C.classifyGenetec(rows) === "cfg") {
      const r = C.parseGenetecConfig(rows, source);
      if (r.error) continue;
      r.rows.forEach((x: any) => g.flux.push({ camera: x.name || x.unit || "", flux: x.stream || "", kbps: x.kbps || 0, resolution: x.resolution || "", fps: x.fps || "", source }));
      flux += r.rows.length;
    } else {
      const r = C.parseGenetecRows(rows, source);
      if (r.error) continue;
      r.units.forEach((u: any) => {
        const n: UniteGenetec = { nom: u.name || "", ip: u.ip || "", mac: u.mac || "", fabricant: u.manufacturer || "", modele: u.model || "", firmware: u.firmware || "", archiveur: u.archiver || "", etat: u.status || "", source };
        // Même caméra déjà connue par un autre fichier : la plus récente l'emporte, les champs vides sont complétés.
        const i = g.unites.findIndex((x) => (n.mac && x.mac === n.mac) || (!n.mac && n.ip && x.ip === n.ip));
        if (i >= 0) { const o = g.unites[i]; (Object.keys(n) as (keyof UniteGenetec)[]).forEach((k) => { if (!n[k] && o[k]) n[k] = o[k]; }); g.unites[i] = n; } else g.unites.push(n);
      });
      unites += r.units.length;
    }
  }
  if (!unites && !flux) throw new Error(`« ${source} » : colonnes Genetec non reconnues (il faut au moins l'adresse IP ou MAC, ou le débit des flux).`);
  g.sources.push({ nom: source, date, type: unites ? "inventaire" : "configuration", lignes: unites || flux });
  return { genetec: g, msg: unites ? `${unites} caméras / unités` : `${flux} flux (débits)` };
}
