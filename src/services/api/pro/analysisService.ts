/**
 * TORP B2B - Service API Analyses de Devis
 *
 * TODO: Implémenter les appels API pour les analyses de devis professionnels
 *
 * Endpoints à implémenter:
 * - GET /api/pro/analyses - Lister toutes les analyses
 * - POST /api/pro/analyses - Créer une nouvelle analyse
 * - GET /api/pro/analyses/:id - Récupérer une analyse
 * - PUT /api/pro/analyses/:id - Mettre à jour une analyse
 * - DELETE /api/pro/analyses/:id - Supprimer une analyse
 * - POST /api/pro/analyses/:id/reanalyze - Re-analyser un devis
 * - POST /api/pro/analyses/:id/ticket - Générer un ticket TORP
 * - GET /api/pro/analyses/:id/tracking - Récupérer les événements de tracking
 */

import { supabase } from '@/lib/supabase';

export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ScoreDetails {
  transparence: number; // 0-250
  offre: number; // 0-250
  robustesse: number; // 0-250
  prix: number; // 0-250
}

export interface Recommendation {
  type: 'transparence' | 'offre' | 'robustesse' | 'prix';
  message: string;
  impact: string; // Ex: "+30pts", "+0.3"
  priority: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  example?: string; // Exemple de formulation
}

export interface PointBloquant {
  type: 'conformite' | 'legal' | 'financial' | 'technical';
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface ProDevisAnalysis {
  id: string;
  company_id: string;
  user_id: string;
  reference_devis: string;
  nom_projet?: string;
  montant_ht?: number;
  montant_ttc?: number;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  status: AnalysisStatus;
  score_total?: number; // 0-1000
  grade?: string; // A+, A, A-, B+, B, B-, C+, C, C-, D, F
  score_details?: ScoreDetails;
  recommandations?: Recommendation[];
  points_bloquants?: PointBloquant[];
  extracted_data?: Record<string, any>;
  version: number;
  parent_analysis_id?: string;
  ticket_genere: boolean;
  ticket_url?: string;
  ticket_code?: string;
  ticket_generated_at?: string;
  ticket_view_count: number;
  ticket_last_viewed_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  analyzed_at?: string;
  updated_at: string;
}

export interface CreateAnalysisData {
  company_id: string;
  reference_devis: string;
  nom_projet?: string;
  montant_ht?: number;
  montant_ttc?: number;
  file: File;
}

export interface TicketTrackingEvent {
  id: string;
  analysis_id: string;
  event_type: 'qr_scanned' | 'link_viewed' | 'pdf_downloaded';
  ip_address?: string;
  user_agent?: string;
  referer?: string;
  country?: string;
  city?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * TODO: Lister toutes les analyses de l'entreprise
 */
export async function listAnalyses(
  companyId: string,
  filters?: {
    status?: AnalysisStatus;
    grade?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ProDevisAnalysis[]> {
  // TODO: Implémenter l'appel Supabase avec filtres
  throw new Error('Not implemented');
}

/**
 * TODO: Récupérer une analyse spécifique
 */
export async function getAnalysis(analysisId: string): Promise<ProDevisAnalysis | null> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Créer une nouvelle analyse
 */
export async function createAnalysis(data: CreateAnalysisData): Promise<ProDevisAnalysis> {
  // TODO: 1. Upload du fichier devis vers Supabase Storage
  // TODO: 2. Créer l'entrée dans la base de données (status: PENDING)
  // TODO: 3. Déclencher l'analyse IA (appel à l'API d'analyse)
  // TODO: 4. Mettre à jour avec les résultats (status: COMPLETED)
  throw new Error('Not implemented');
}

/**
 * TODO: Re-analyser un devis (créer une nouvelle version)
 */
export async function reanalyzeDevis(
  parentAnalysisId: string,
  file?: File
): Promise<ProDevisAnalysis> {
  // TODO: 1. Créer une nouvelle analyse avec parent_analysis_id
  // TODO: 2. Incrémenter la version
  // TODO: 3. Lancer l'analyse
  throw new Error('Not implemented');
}

/**
 * TODO: Mettre à jour une analyse
 */
export async function updateAnalysis(
  analysisId: string,
  data: Partial<ProDevisAnalysis>
): Promise<ProDevisAnalysis> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Supprimer une analyse
 */
export async function deleteAnalysis(analysisId: string): Promise<void> {
  // TODO: 1. Supprimer le fichier de Supabase Storage
  // TODO: 2. Supprimer l'entrée de la base de données
  throw new Error('Not implemented');
}

/**
 * TODO: Générer un ticket TORP (badge de certification)
 */
export async function generateTicket(analysisId: string): Promise<{
  ticket_url: string;
  ticket_code: string;
  qr_code_url: string;
}> {
  // TODO: 1. Générer un code unique (ex: TORP-ABC123XY)
  // TODO: 2. Générer le QR code (lien vers /t/:code)
  // TODO: 3. Générer le PDF du ticket
  // TODO: 4. Mettre à jour l'analyse avec les infos du ticket
  throw new Error('Not implemented');
}

/**
 * TODO: Récupérer les événements de tracking d'un ticket
 */
export async function getTicketTracking(analysisId: string): Promise<TicketTrackingEvent[]> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Récupérer une analyse via son ticket_code (pour la page publique)
 */
export async function getAnalysisByTicketCode(
  ticketCode: string
): Promise<ProDevisAnalysis | null> {
  // TODO: Implémenter l'appel Supabase (accessible sans auth)
  throw new Error('Not implemented');
}

/**
 * TODO: Enregistrer un événement de tracking de ticket
 */
export async function trackTicketView(
  ticketCode: string,
  eventType: 'qr_scanned' | 'link_viewed' | 'pdf_downloaded',
  metadata?: Record<string, any>
): Promise<void> {
  // TODO: 1. Récupérer l'analysis_id depuis le ticket_code
  // TODO: 2. Créer un événement de tracking
  // TODO: 3. Incrémenter le compteur de vues
  throw new Error('Not implemented');
}
