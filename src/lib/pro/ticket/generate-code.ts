/**
 * Génération de code unique pour les tickets TORP
 * Format : TORP-XXXXXX (6 caractères alphanumériques)
 */

import { supabase } from '@/lib/supabase';

// Caractères utilisés (sans ambiguïté)
// Exclus : 0, O, I, L, 1 (confusion possible)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export interface TicketCode {
  code: string;        // Ex: "TORP-A7X9K2"
  shortCode: string;   // Ex: "A7X9K2"
  url: string;         // Ex: "https://torp.fr/t/A7X9K2"
  qrData: string;      // Données encodées dans le QR
}

/**
 * Génère un code aléatoire de la longueur spécifiée
 */
function generateRandomCode(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}

/**
 * Vérifie si un code existe déjà en base
 */
async function codeExists(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pro_devis_analyses')
    .select('id')
    .eq('ticket_code', code)
    .single();

  // Si data existe, le code est déjà utilisé
  // Si error et code PGRST116 (not found), le code est disponible
  return !!data;
}

/**
 * Génère un code unique pour un ticket
 */
export async function generateTicketCode(analysisId: string): Promise<TicketCode> {
  let attempts = 0;
  let shortCode: string;
  let exists = true;

  // Essayer de générer un code unique (max 10 tentatives)
  do {
    shortCode = generateRandomCode(6);
    exists = await codeExists(shortCode);
    attempts++;

    if (!exists) break;

    if (attempts >= 10) {
      throw new Error('Unable to generate unique ticket code after 10 attempts');
    }
  } while (exists);

  // Construire l'URL complète
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://torp.fr';
  const url = `${baseUrl}/t/${shortCode}`;

  return {
    code: `TORP-${shortCode}`,
    shortCode,
    url,
    qrData: url,
  };
}

/**
 * Formatte un code pour l'affichage (ajoute le préfixe TORP-)
 */
export function formatTicketCode(shortCode: string): string {
  return `TORP-${shortCode}`;
}

/**
 * Valide le format d'un code ticket
 */
export function validateTicketCode(code: string): boolean {
  // Vérifier le format : 6 caractères de l'alphabet autorisé
  const codeWithoutPrefix = code.replace('TORP-', '');

  if (codeWithoutPrefix.length !== 6) {
    return false;
  }

  // Vérifier que tous les caractères sont dans l'alphabet
  for (const char of codeWithoutPrefix) {
    if (!ALPHABET.includes(char)) {
      return false;
    }
  }

  return true;
}
