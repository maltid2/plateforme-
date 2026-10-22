// Adresse de contact publique. Surchargée par NEXT_PUBLIC_CONTACT_EMAIL si
// définie dans Vercel (même source que le pop-up « Passez à l'action »).
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@sentrylescope.fr";

export function contactHref(subject: string) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export const CONTACT_HREF = contactHref("Question sur SentinelScope");
