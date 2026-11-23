/**
 * Les topologies : plusieurs cartes indépendantes dans le même outil.
 *
 * Tout est rangé dans le stockage local du navigateur, sur ce PC. Rien ne
 * part ailleurs. Comme ce stockage peut être vidé (nettoyage du navigateur,
 * changement de poste), la sauvegarde en fichier .json reste la référence à
 * classer avec vos documents.
 */
export type Topologie = { id: string; nom: string; texte: string; modifie: number };
export type Classeur = { version: 1; active: string; topologies: Topologie[] };

const CLE = "carte-reseau:classeur";
const ANCIENNE = "carte-reseau:saisie";

const lire = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

export const nouvelId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function nouvelle(nom: string, texte = ""): Topologie {
  return { id: nouvelId(), nom, texte, modifie: Date.now() };
}

function valide(c: unknown): c is Classeur {
  const x = c as Classeur;
  return !!x && Array.isArray(x.topologies) && x.topologies.every((t) => typeof t.id === "string" && typeof t.texte === "string");
}

export function charger(): Classeur {
  try {
    const brut = lire(CLE);
    if (brut) {
      const c = JSON.parse(brut);
      if (valide(c) && c.topologies.length) {
        if (!c.topologies.some((t) => t.id === c.active)) c.active = c.topologies[0].id;
        return c;
      }
    }
  } catch { /* stockage illisible : on repart d'une carte vide */ }
  // Première ouverture, ou ancienne version à une seule saisie.
  const ancienne = lire(ANCIENNE);
  // Première ouverture : une carte vide, à remplir avec ses propres sites.
  const t = nouvelle("Ma carte", ancienne ?? "");
  return { version: 1, active: t.id, topologies: [t] };
}

export function sauver(c: Classeur): boolean {
  return ecrire(CLE, JSON.stringify(c));
}

/** La signature des documents produits : gardée sur ce poste, modifiable. */
const CLE_AUTEUR = "carte-reseau:auteur";
export const AUTEUR_DEFAUT = "Dyvan";
/** Signature enregistrée sur ce poste ; vide = on ne signe pas (choix respecté). */
export const lireAuteur = () => { const v = lire(CLE_AUTEUR); return v === null ? AUTEUR_DEFAUT : v.trim(); };
export const ecrireAuteur = (nom: string) => ecrire(CLE_AUTEUR, nom.trim());

/** Fichier de sauvegarde complet (toutes les topologies). */
export function exporter(c: Classeur, auteur = lireAuteur()): string {
  return JSON.stringify({ ...c, exporte: new Date().toISOString(), auteur, outil: "carte-reseau" }, null, 2);
}

/** Ajoute les topologies d'un fichier de sauvegarde, sans écraser l'existant. */
export function importer(c: Classeur, json: string): { ajoutees: number } {
  const d = JSON.parse(json);
  if (!valide(d)) throw new Error("Ce fichier n'est pas une sauvegarde de Topologie réseau v1.");
  let ajoutees = 0;
  d.topologies.forEach((t) => {
    const existe = c.topologies.find((x) => x.id === t.id);
    if (existe && existe.texte === t.texte) return;
    const copie = { ...t, id: existe ? nouvelId() : t.id, nom: existe ? `${t.nom} (importée)` : t.nom };
    c.topologies.push(copie);
    ajoutees++;
  });
  return { ajoutees };
}
