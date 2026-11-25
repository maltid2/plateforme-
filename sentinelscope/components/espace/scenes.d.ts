// Les scènes sont écrites en JavaScript (portées des prototypes) : on ne
// déclare ici que leur point d'entrée, seul contrat que le site utilise.
declare module "@/components/espace/agentshield/scene.js" {
  export function demarrer(root: HTMLElement): () => void;
}
declare module "@/components/espace/commerce/scene.js" {
  export function demarrer(root: HTMLElement): () => void;
}
declare module "@/components/espace/hub/scene.js" {
  export function demarrer(root: HTMLElement, opts: { aller: (id: string) => void; survoler: (i: number) => void }): () => void;
}
