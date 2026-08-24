'use strict';

/**
 * Moteur de scoring global
 *
 * Chaque module retourne une note sur 100. Le score global est une moyenne
 * pondérée : SSL et headers pèsent plus lourd que les « bonnes pratiques
 * SaaS ». Le score numérique est ensuite mappé en lettre A/B/C/D/F pour
 * l'aspect « vendeur » du rapport.
 *
 * Les modules en mode dégradé (source/clé API absente) sont exclus de la
 * moyenne afin de ne pas fausser le score, sauf s'ils remontent une alerte.
 */

const WEIGHTS = {
  A1: 25, // SSL/TLS
  A2: 25, // Headers HTTP
  A3: 20, // Fichiers sensibles
  B: 10, // Réputation
  C: 12, // Technologies + CVE
  D: 8, // Bonnes pratiques SaaS
};

function scoreToLetter(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function letterMeaning(letter) {
  switch (letter) {
    case 'A':
      return 'Excellent — posture de sécurité solide.';
    case 'B':
      return 'Bon — quelques améliorations recommandées.';
    case 'C':
      return 'Moyen — plusieurs points à corriger.';
    case 'D':
      return 'Faible — corrections importantes nécessaires.';
    default:
      return 'Critique — vulnérabilités majeures à traiter en priorité.';
  }
}

/**
 * @param {object[]} moduleResults - résultats de chaque module (avec .module, .score, .degraded)
 * @returns {object} { score, letter, meaning, breakdown, findingsSummary }
 */
function compute(moduleResults) {
  const breakdown = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const mod of moduleResults) {
    if (!mod || mod.module == null) continue;
    const weight = WEIGHTS[mod.module] != null ? WEIGHTS[mod.module] : 5;

    // Un module dégradé SANS finding actionnable est neutralisé (exclu).
    const hasRealFinding =
      Array.isArray(mod.findings) &&
      mod.findings.some((f) => f.severity && f.severity !== 'info');
    const excluded = mod.degraded && !hasRealFinding;

    breakdown.push({
      module: mod.module,
      name: mod.name,
      score: mod.score,
      weight,
      excluded,
      error: mod.error || null,
    });

    if (!excluded) {
      weightedSum += mod.score * weight;
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const letter = scoreToLetter(score);

  // Récapitulatif des findings par sévérité.
  const findingsSummary = { high: 0, medium: 0, low: 0, info: 0 };
  for (const mod of moduleResults) {
    if (!mod || !Array.isArray(mod.findings)) continue;
    for (const f of mod.findings) {
      const sev = f.severity || 'info';
      if (findingsSummary[sev] == null) findingsSummary[sev] = 0;
      findingsSummary[sev]++;
    }
  }

  return {
    score,
    letter,
    meaning: letterMeaning(letter),
    breakdown,
    findingsSummary,
  };
}

module.exports = { compute, scoreToLetter, letterMeaning, WEIGHTS };
