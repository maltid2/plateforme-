/** Petits outils partagés par l'interface : éléments, fichiers, menus, accords. */

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** « 1 câble », « 3 câbles » (pluriel régulier, ou donné). */
export const pl = (n: number, mot: string, pluriel = `${mot}s`) => `${n} ${n > 1 ? pluriel : mot}`;

/** Un fichier produit sur le poste, proposé au téléchargement (rien n'est envoyé). */
export function telecharger(nom: string, contenu: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/** Nom de fichier sans accents ni caractères gênants. */
export const nomFichier = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "carte";
export const dateDuJour = () => new Date().toISOString().slice(0, 10);

/** Referme les menus déroulants (Fichiers, ⋯). */
export const fermerMenu = () => document.querySelectorAll("details.menu").forEach((m) => m.removeAttribute("open"));

/** Texte d'un fichier : UTF-8, ou l'ancien codage Windows si les accents sont cassés. */
export async function lireTexte(f: File): Promise<string> {
  const octets = new Uint8Array(await f.arrayBuffer());
  const t = new TextDecoder("utf-8").decode(octets);
  return t.includes("�") ? new TextDecoder("windows-1252").decode(octets) : t;
}

/** Les fichiers choisis dans un <input type="file">, puis la case est vidée (même fichier rechoisissable). */
export function surFichiers(id: string, faire: (fichiers: File[]) => void | Promise<void>) {
  $<HTMLInputElement>(id).addEventListener("change", (e) => {
    const i = e.target as HTMLInputElement;
    const liste = [...(i.files ?? [])];
    i.value = "";
    if (liste.length) void faire(liste);
  });
}
