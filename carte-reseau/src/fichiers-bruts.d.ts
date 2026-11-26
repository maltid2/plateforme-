// Fichiers inclus tels quels dans l'outil (import « ?raw » de Vite).
declare module "*?raw" {
  const contenu: string;
  export default contenu;
}
