/**
 * Patterns d'extraction pour l'OCR des devis
 * Regex optimisées pour détecter les informations clés dans les devis BTP
 */

export const EXTRACTION_PATTERNS = {
  // ===== IDENTIFICATION ENTREPRISE =====

  // SIRET : 14 chiffres consécutifs ou formatés (espaces ou points)
  siret: /(?:SIRET|Siret|siret)\s*[:\s]?\s*(\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5}|\d{14})/i,

  // SIREN : 9 chiffres
  siren: /(?:SIREN|Siren|siren)\s*[:\s]?\s*(\d{3}[\s.]?\d{3}[\s.]?\d{3}|\d{9})/i,

  // TVA Intracommunautaire
  tvaIntra: /(?:TVA|N°\s*TVA|Numéro\s*TVA|N°\s*de\s*TVA|TVA\s*intracommunautaire)[^:]*[:\s]?\s*(FR\s?\d{2}\s?\d{9})/i,

  // RCS
  rcs: /(?:RCS|R\.C\.S\.|Registre\s*du\s*commerce)\s+([A-Z][A-Za-z\s]+(?:B|A)\s*\d+)/i,

  // Forme juridique
  formeJuridique: /\b(SARL|SAS|SASU|EURL|SA|SNC|SCI|EI|EIRL|Auto[-\s]?entrepreneur|Micro[-\s]?entreprise)\b/i,

  // Capital social
  capitalSocial: /(?:capital\s*(?:social)?|au\s*capital\s*de)\s*[:\s]?\s*(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)\s*€?/i,

  // ===== ASSURANCES =====

  // Numéro décennale (patterns variés)
  decennale: /(?:décennale|decennale|garantie\s*décennale)[^:]*[:\s]?\s*(?:n°|N°|numéro|num|numero)?\s*([A-Z0-9\-\/]{5,25})/i,

  // Assureur
  assureur: /(?:assur(?:é|e)\s*(?:par|auprès\s*de|chez)|compagnie|assureur)[:\s]*([A-Z][A-Za-z\s&]+?)(?:\s*[-–]\s*|\s*,|\s*\.|\s*\n|\s*$)/i,

  // Validité assurance
  validiteAssurance: /(?:valable|valide?|validité)[^:]*[:\s]?\s*(?:jusqu'au|au)?\s*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4})/i,

  // RC Pro
  rcPro: /(?:RC\s*Pro|R\.C\.\s*Pro|Responsabilité\s*Civile\s*Professionnelle)[^:]*[:\s]?\s*(?:n°|N°)?\s*([A-Z0-9\-\/]{5,25})/i,

  // ===== DONNÉES FINANCIÈRES =====

  // Montant TTC (plusieurs formats)
  montantTTC: /(?:TOTAL\s*TTC|Montant\s*TTC|Net\s*[àa]\s*payer|TTC|Total\s*[àa]\s*payer)[:\s]*(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)\s*€?/i,

  // Montant HT
  montantHT: /(?:TOTAL\s*HT|Montant\s*HT|Total\s*Hors\s*Taxes?|Sous[-\s]?total\s*HT)[:\s]*(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)\s*€?/i,

  // TVA (taux et montant)
  tva: /(?:TVA|T\.V\.A\.)\s*(?:\(?(\d{1,2}(?:[.,]\d{1,2})?)\s*%\)?)?[:\s]*(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)\s*€?/i,

  // Taux TVA seul
  tauxTVA: /TVA\s*(?:à)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/gi,

  // Acompte
  acompte: /(?:Acompte|Accompte|Arrhes)[^:]*[:\s]*(\d{1,3}(?:[.,]\d{2})?)\s*(?:€|%)/i,

  // Conditions de paiement
  conditionsPaiement: /(?:Conditions?\s*de\s*paiement|Modalités\s*de\s*paiement|Règlement)[:\s]*([^\n]{10,200})/i,

  // ===== INFORMATIONS DEVIS =====

  // Date devis
  dateDevis: /(?:Date|Le|Fait\s*le|Émis\s*le|Du|Etabli\s*le)[:\s]*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4})/i,

  // Numéro devis
  numeroDevis: /(?:Devis|N°|Numéro|Référence|Réf\.?|Devis\s*n°)\s*[:\s]?\s*([A-Z0-9\-\/]{3,20})/i,

  // Validité devis
  validiteDevis: /(?:Valid(?:e|ité)|Valable)[^:]*[:\s]*(?:jusqu'au|au|pendant)?\s*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4}|\d+\s*(?:jours?|mois))/i,

  // Objet/Description
  objet: /(?:Objet|Concerne|Description|Nature\s*des\s*travaux)[:\s]*([^\n]{10,200})/i,

  // ===== CLIENT =====

  // Nom client (après "Client:", "Monsieur", "Madame")
  clientNom: /(?:Client|Madame|Monsieur|M\.|Mme|Mr)[:\s]*([A-Z][A-Za-zÀ-ÿ\s\-']{3,50})/i,

  // Adresse (ligne avec numéro + rue)
  adresse: /(\d{1,4}(?:\s*bis|ter)?\s+(?:rue|avenue|boulevard|allée|chemin|place|cours|impasse|passage)[^\n,]{5,100})/i,

  // Code postal + Ville
  codePostalVille: /(\d{5})\s+([A-Z][A-Za-zÀ-ÿ\s\-']{2,50})/,

  // Téléphone
  telephone: /(?:Tél|Tel|Téléphone|Phone|Mobile)[:\s]*(\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2})/i,

  // Email
  email: /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/,

  // Site web
  siteWeb: /((?:www\.|https?:\/\/)[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i,

  // ===== MENTIONS LÉGALES =====

  // Délai d'exécution
  delaiExecution: /(?:Délai|Durée)[^:]*[:\s]*(\d+)\s*(jours?\s*ouvrés?|jours?|semaines?|mois)/i,

  // Droit de rétractation
  droitRetractation: /(?:droit\s*de\s*rétractation|délai\s*de\s*rétractation)/i,

  // CGV
  cgv: /(?:Conditions?\s*Générales?\s*de\s*Vente|C\.G\.V\.)/i,

  // Médiateur
  mediateur: /(?:médiateur|médiation\s*de\s*la\s*consommation)/i,

  // Garanties
  garantieDecennale: /(?:garantie\s*décennale)/i,
  garantieBiennale: /(?:garantie\s*biennale|garantie\s*de\s*2\s*ans)/i,
  garantiePerfectionnement: /(?:garantie\s*de\s*parfait\s*achèvement|parfait\s*achèvement)/i,

  // Pénalités de retard
  penalitesRetard: /(?:pénalités?\s*de\s*retard|intérêts?\s*de\s*retard)/i,

  // ===== CERTIFICATIONS =====

  certifications: {
    rge: /\b(?:RGE|Reconnu\s*Garant\s*(?:de\s*l')?Environnement)\b/i,
    qualibat: /\bQualibat\b/i,
    qualifelec: /\bQualifelec\b/i,
    qualipac: /\bQualiPAC\b/i,
    qualibois: /\bQualibois\b/i,
    qualipv: /\bQualiPV\b/i,
    handibat: /\bHandibat\b/i,
    qualigaz: /\bQualigaz\b/i,
  },
};

/**
 * Helper pour extraire et nettoyer une valeur numérique
 */
export function parseAmount(value: string): number | null {
  if (!value) return null;

  // Remplacer les séparateurs français (espace, virgule) par format anglais
  const cleaned = value
    .replace(/\s/g, '')        // Supprimer espaces
    .replace(/\./g, '')        // Supprimer points (milliers)
    .replace(/,/g, '.');       // Virgule → point décimal

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Helper pour parser une date au format français
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Formats supportés: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const parts = dateStr.split(/[\s\/\-\.]/);

  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Mois 0-indexed
  const year = parseInt(parts[2], 10);

  // Gérer années sur 2 chiffres
  const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;

  const date = new Date(fullYear, month, day);

  // Vérifier validité
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Helper pour nettoyer du texte extrait
 */
export function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')      // Normaliser espaces multiples
    .replace(/\n+/g, ' ');     // Remplacer retours à la ligne
}

/**
 * Helper pour extraire toutes les lignes de prestation d'un texte
 */
export function extractLignesPrestation(text: string): Array<{
  designation: string;
  description?: string;
  quantite?: number;
  unite?: string;
  prixUnitaireHT?: number;
  totalLigneHT?: number;
}> {
  const lignes: Array<any> = [];

  // Pattern pour détecter une ligne de prestation
  // Format typique: "Désignation    Qté    Unité    PU HT    Total HT"
  const lignePattern = /^(.{10,80})\s+(\d+(?:[.,]\d{1,2})?)\s+([\w\/]+)?\s+(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)\s+(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)$/gm;

  let match;
  while ((match = lignePattern.exec(text)) !== null) {
    lignes.push({
      designation: cleanText(match[1]),
      quantite: parseAmount(match[2]),
      unite: match[3] || 'unité',
      prixUnitaireHT: parseAmount(match[4]),
      totalLigneHT: parseAmount(match[5]),
    });
  }

  // Fallback: chercher simplement les lignes avec montants
  if (lignes.length === 0) {
    const simpleLignePattern = /^(.{10,100})\s+(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})?)\s*€?$/gm;

    while ((match = simpleLignePattern.exec(text)) !== null) {
      const designation = cleanText(match[1]);
      const montant = parseAmount(match[2]);

      // Éviter les totaux
      if (!designation.match(/total|sous[-\s]?total|montant/i) && montant) {
        lignes.push({
          designation,
          totalLigneHT: montant,
        });
      }
    }
  }

  return lignes;
}
