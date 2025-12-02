/**
 * Génération de codes uniques pour les tickets TORP
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
 * Génère un code aléatoire de longueur donnée
 */
function generateRandomCode(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}

/**
 * Génère un code unique pour un ticket TORP
 */
export async function generateTicketCode(analysisId: string): Promise<TicketCode> {
  let attempts = 0;
  let shortCode: string;
  let exists = true;

  // Générer un code unique (max 5 tentatives)
  do {
    shortCode = generateRandomCode(6);

    // Vérifier si le code existe déjà
    const { data, error } = await supabase
      .from('pro_devis_analyses')
      .select('id')
      .eq('ticket_code', shortCode)
      .maybeSingle();

    if (error) {
      console.error('Error checking ticket code uniqueness:', error);
      throw new Error('Failed to generate unique ticket code');
    }

    exists = !!data;
    attempts++;
  } while (exists && attempts < 5);

  if (attempts >= 5 && exists) {
    throw new Error('Unable to generate unique ticket code after 5 attempts');
  }

  // Construire l'URL
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const url = `${baseUrl}/t/${shortCode}`;

  return {
    code: `TORP-${shortCode}`,
    shortCode,
    url,
    qrData: url,
  };
}

/**
 * Valide le format d'un code ticket
 */
export function validateTicketCode(code: string): boolean {
  const pattern = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
  return pattern.test(code);
}
