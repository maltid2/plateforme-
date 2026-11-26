/** La barre à glisser entre la saisie et la carte : largeur mémorisée sur le poste. */
import { $ } from "./outils.ts";

export function installerLargeurSaisie() {
  const atelier = document.querySelector<HTMLElement>(".atelier")!;
  const sep = $("separateur");
  const CLE_L = "carte-reseau:largeur-saisie";
  const borner = (px: number) => Math.round(Math.max(300, Math.min(window.innerWidth - 360, px)));
  const appliquerL = (px: number, garder = true) => {
    const v = borner(px);
    atelier.style.setProperty("--largeur-saisie", `${v}px`);
    sep.setAttribute("aria-valuenow", String(v));
    if (garder) try { localStorage.setItem(CLE_L, String(v)); } catch { /* sans importance */ }
  };
  const actuelle = () => document.querySelector<HTMLElement>(".saisie")!.getBoundingClientRect().width;
  try { const v = Number(localStorage.getItem(CLE_L)); if (v > 0) appliquerL(v, false); } catch { /* sans importance */ }
  let depart: { x: number; l: number } | null = null;
  sep.addEventListener("pointerdown", (e) => {
    depart = { x: e.clientX, l: actuelle() };
    sep.setPointerCapture(e.pointerId);
    sep.classList.add("actif"); document.body.classList.add("redim");
  });
  sep.addEventListener("pointermove", (e) => { if (depart) appliquerL(depart.l + e.clientX - depart.x); });
  const fin = () => { depart = null; sep.classList.remove("actif"); document.body.classList.remove("redim"); };
  sep.addEventListener("pointerup", fin);
  sep.addEventListener("pointercancel", fin);
  // Double-clic : grand (70 % de l'écran) ou normal.
  sep.addEventListener("dblclick", () => appliquerL(actuelle() > window.innerWidth * 0.55 ? window.innerWidth * 0.38 : window.innerWidth * 0.7));
  sep.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); appliquerL(actuelle() + (e.key === "ArrowRight" ? 40 : -40)); }
  });
  window.addEventListener("resize", () => { const v = Number(atelier.style.getPropertyValue("--largeur-saisie").replace("px", "")); if (v) appliquerL(v, false); });
}
