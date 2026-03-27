/**
 * RuleKeywordExtractor
 * Extrait les concepts clés d'une description de règle ou d'une ligne de devis.
 * Pure TypeScript — aucune dépendance externe.
 *
 * Stratégie:
 *  1. Tokenisation + normalisation (lower, sans accents, sans ponctuation)
 *  2. Filtrage stop-words français (articles, prépositions, conjonctions)
 *  3. Filtrage longueur < 3 chars
 *  4. Bonus: les property_key snake_case sont décomposés en termes supplémentaires
 */

// ── Stop-words français ────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'un', 'une', 'des', 'le', 'la', 'les', 'du', 'de', 'et', 'ou', 'mais',
  'est', 'sont', 'avoir', 'etre', 'pour', 'par', 'en', 'a', 'aux', 'au',
  'ce', 'cette', 'cet', 'ces', 'qui', 'que', 'dont', 'ou', 'comment',
  'pas', 'ne', 'se', 'si', 'il', 'ils', 'elle', 'elles', 'on', 'nous', 'vous',
  'leur', 'leurs', 'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'avec', 'sans',
  'dans', 'sur', 'sous', 'entre', 'vers', 'chez', 'lors', 'apres', 'avant',
  'doit', 'doit', 'doivent', 'peut', 'peuvent', 'fait', 'font', 'lors',
  'afin', 'tout', 'toute', 'tous', 'toutes', 'autre', 'autres',
  'chaque', 'meme', 'plus', 'moins', 'tres', 'bien', 'aussi', 'ainsi',
  'selon', 'relatif', 'relative', 'applicable', 'concernant', 'notamment',
  'obligatoire', 'interdite', 'interdit', 'requis', 'requise', 'realise',
]);

// ── Normalisation ─────────────────────────────────────────────────────────────

/** Supprime accents, met en minuscules, garde lettres+chiffres. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // supprime diacritiques
    .replace(/[''`]/g, ' ')           // apostrophes → espace (l'eau → l eau)
    .replace(/[^a-z0-9\s_-]/g, ' ');  // retire tout sauf lettres, chiffres, _, -
}

/** Décompose un property_key snake_case en tokens individuels. */
function expandSnakeCase(key: string): string[] {
  return key.split(/[_-]+/).filter((t) => t.length >= 3);
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Extrait les keywords d'un texte libre (description de règle ou ligne de devis).
 * Retourne un tableau déduplicationné, sans stop-words, longueur ≥ 3.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  const normalized = normalize(text);
  const tokens = normalized
    .split(/[\s,;:!?()[\]{}]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  return [...new Set(tokens)];
}

/**
 * Extrait les keywords d'une règle en exploitant aussi le property_key.
 * property_key (ex: "coupe_circuit_securite") est un signal de qualité supérieure.
 */
export function extractRuleKeywords(
  description: string,
  propertyKey?: string | null,
): string[] {
  const fromDesc = extractKeywords(description);
  const fromProp = propertyKey ? expandSnakeCase(normalize(propertyKey)) : [];
  // Les termes du property_key apparaissent en premier (signal fort)
  return [...new Set([...fromProp, ...fromDesc])];
}

/**
 * Score de couverture d'une règle par le texte du devis.
 * Retourne un score 0–1 :
 *   - 0   : aucun terme de la règle mentionné
 *   - 0.5 : quelques termes mentionnés
 *   - 1   : tous les termes principaux présents
 *
 * Algorithme : fraction des termes-règle trouvés (substring) dans le texte devis.
 * Plus tolérant que Jaccard — un seul terme suffit pour un score partiel.
 */
export function coverageScore(
  ruleKeywords: string[],
  devisNormalized: string,
): number {
  if (ruleKeywords.length === 0) return 0;

  let matches = 0;
  for (const kw of ruleKeywords) {
    // Substring match sur le texte normalisé complet du devis
    if (devisNormalized.includes(kw)) {
      matches++;
    }
  }

  return matches / ruleKeywords.length;
}

/**
 * Pré-normalise le texte complet du devis (toutes les lignes concaténées).
 * À appeler une fois et réutiliser pour toutes les règles.
 */
export function normalizeDevisText(lines: Array<{ description: string }>): string {
  return normalize(lines.map((l) => l.description).join(' '));
}

/**
 * Distance de Levenshtein (pour fuzzy match optionnel).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy match : un keyword de la règle apparaît-il approx. dans les keywords devis ?
 * threshold : 0 = exact, 1 = tout match. Défaut 0.2 (distance ≤ 20% de la longueur).
 */
export function fuzzyKeywordMatch(
  ruleKeyword: string,
  devisKeywords: string[],
  maxDistanceRatio = 0.2,
): boolean {
  for (const dk of devisKeywords) {
    const dist = levenshteinDistance(ruleKeyword, dk);
    const ratio = dist / Math.max(ruleKeyword.length, dk.length);
    if (ratio <= maxDistanceRatio) return true;
  }
  return false;
}
