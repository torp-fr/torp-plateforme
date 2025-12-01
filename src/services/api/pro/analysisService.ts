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
import QRCode from 'qrcode';

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
 * Lister toutes les analyses de l'entreprise
 */
export async function listAnalyses(
  companyId: string,
  filters?: {
    status?: AnalysisStatus;
    grade?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }
): Promise<ProDevisAnalysis[]> {
  let query = supabase
    .from('pro_devis_analyses')
    .select('*')
    .eq('company_id', companyId);

  // Appliquer les filtres
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.grade) {
    query = query.eq('grade', filters.grade);
  }

  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  // Appliquer la limite si spécifiée
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Récupérer une analyse spécifique
 */
export async function getAnalysis(analysisId: string): Promise<ProDevisAnalysis | null> {
  const { data, error } = await supabase
    .from('pro_devis_analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Créer une nouvelle analyse
 */
export async function createAnalysis(data: CreateAnalysisData): Promise<ProDevisAnalysis> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { file, company_id, reference_devis, nom_projet, montant_ht, montant_ttc } = data;

  // 1. Upload du fichier devis vers Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('devis-analyses')
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Récupérer l'URL du fichier
  const { data: { publicUrl } } = supabase.storage
    .from('devis-analyses')
    .getPublicUrl(fileName);

  // 2. Créer l'entrée dans la base de données (status: PENDING)
  const { data: analysis, error: dbError } = await supabase
    .from('pro_devis_analyses')
    .insert({
      company_id,
      user_id: user.id,
      reference_devis,
      nom_projet,
      montant_ht,
      montant_ttc,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      status: 'PENDING',
      version: 1,
    })
    .select()
    .single();

  if (dbError) {
    // Si l'insertion DB échoue, supprimer le fichier uploadé
    await supabase.storage
      .from('devis-analyses')
      .remove([fileName]);

    throw dbError;
  }

  // 3. Déclencher l'analyse IA en arrière-plan
  // TODO: Implémenter l'appel à l'API d'analyse IA
  // Pour l'instant, simuler une analyse mock
  setTimeout(async () => {
    await runMockAnalysis(analysis.id);
  }, 2000);

  return analysis;
}

/**
 * Fonction mock pour simuler l'analyse IA
 * TODO: Remplacer par un vrai appel API (OpenAI, Claude, etc.)
 */
async function runMockAnalysis(analysisId: string): Promise<void> {
  console.warn('⚠️ Running MOCK analysis. Implement real AI analysis in production.');

  // Simuler un délai d'analyse
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Scores mock
  const scores: ScoreDetails = {
    transparence: Math.floor(Math.random() * 100) + 150, // 150-250
    offre: Math.floor(Math.random() * 100) + 150,
    robustesse: Math.floor(Math.random() * 100) + 150,
    prix: Math.floor(Math.random() * 100) + 150,
  };

  const scoreTotal = scores.transparence + scores.offre + scores.robustesse + scores.prix;

  // Calculer le grade via la fonction SQL
  const { data: gradeData } = await supabase
    .rpc('calculate_grade_from_score', { score: scoreTotal });

  const grade = gradeData || 'B';

  // Recommandations mock
  const recommandations: Recommendation[] = [
    {
      type: 'transparence',
      message: 'Ajoutez les références exactes des matériaux utilisés',
      impact: '+30pts',
      priority: 'high',
      difficulty: 'easy',
      example: 'Ex: Parquet chêne massif 14mm - Réf. OAK-PRE-14',
    },
    {
      type: 'robustesse',
      message: 'Mentionnez explicitement la garantie décennale',
      impact: '+25pts',
      priority: 'high',
      difficulty: 'easy',
    },
  ];

  // Mettre à jour l'analyse avec les résultats
  await supabase
    .from('pro_devis_analyses')
    .update({
      status: 'COMPLETED',
      score_total: scoreTotal,
      grade,
      score_details: scores,
      recommandations,
      analyzed_at: new Date().toISOString(),
    })
    .eq('id', analysisId);
}

/**
 * Re-analyser un devis (créer une nouvelle version)
 */
export async function reanalyzeDevis(
  parentAnalysisId: string,
  file?: File
): Promise<ProDevisAnalysis> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Récupérer l'analyse parente
  const parentAnalysis = await getAnalysis(parentAnalysisId);

  if (!parentAnalysis) {
    throw new Error('Parent analysis not found');
  }

  // Utiliser le nouveau fichier ou celui de l'analyse parente
  const fileToUse = file || null;

  if (!fileToUse) {
    throw new Error('No file provided for re-analysis');
  }

  // Créer une nouvelle analyse avec version incrémentée
  const newAnalysis = await createAnalysis({
    company_id: parentAnalysis.company_id,
    reference_devis: parentAnalysis.reference_devis,
    nom_projet: parentAnalysis.nom_projet,
    montant_ht: parentAnalysis.montant_ht,
    montant_ttc: parentAnalysis.montant_ttc,
    file: fileToUse,
  });

  // Mettre à jour avec parent_analysis_id et version
  const { data: updated, error } = await supabase
    .from('pro_devis_analyses')
    .update({
      parent_analysis_id: parentAnalysisId,
      version: parentAnalysis.version + 1,
    })
    .eq('id', newAnalysis.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return updated;
}

/**
 * Mettre à jour une analyse
 */
export async function updateAnalysis(
  analysisId: string,
  data: Partial<ProDevisAnalysis>
): Promise<ProDevisAnalysis> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Retirer les champs non modifiables
  const {
    id: _,
    user_id,
    company_id,
    file_url,
    file_name,
    created_at,
    updated_at,
    ...updateData
  } = data as any;

  const { data: analysis, error } = await supabase
    .from('pro_devis_analyses')
    .update(updateData)
    .eq('id', analysisId)
    .eq('user_id', user.id) // Sécurité
    .select()
    .single();

  if (error) {
    throw error;
  }

  return analysis;
}

/**
 * Supprimer une analyse
 */
export async function deleteAnalysis(analysisId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Récupérer l'analyse
  const analysis = await getAnalysis(analysisId);

  if (!analysis) {
    throw new Error('Analysis not found');
  }

  // Supprimer le fichier du Storage
  const fileName = analysis.file_url.split('/').pop();

  if (fileName) {
    const { error: storageError } = await supabase.storage
      .from('devis-analyses')
      .remove([`${user.id}/${fileName}`]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
    }
  }

  // Supprimer l'entrée de la base de données
  const { error: dbError } = await supabase
    .from('pro_devis_analyses')
    .delete()
    .eq('id', analysisId)
    .eq('user_id', user.id); // Sécurité

  if (dbError) {
    throw dbError;
  }
}

/**
 * Générer un ticket TORP (badge de certification)
 */
export async function generateTicket(analysisId: string): Promise<{
  ticket_url: string;
  ticket_code: string;
  qr_code_url: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const analysis = await getAnalysis(analysisId);

  if (!analysis || analysis.status !== 'COMPLETED') {
    throw new Error('L\'analyse doit être terminée avant de générer un ticket');
  }

  if (analysis.ticket_genere && analysis.ticket_code) {
    throw new Error('Un ticket a déjà été généré pour cette analyse');
  }

  // 1. Générer un code unique via la fonction SQL
  const { data: ticketCode, error: codeError } = await supabase
    .rpc('generate_ticket_code');

  if (codeError || !ticketCode) {
    console.error('Erreur génération code ticket:', codeError);
    throw new Error('Impossible de générer le code du ticket');
  }

  // 2. Générer le QR code
  const publicUrl = `${window.location.origin}/t/${ticketCode}`;

  let qrCodeDataUrl: string;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('Erreur génération QR code:', err);
    throw new Error('Impossible de générer le QR code');
  }

  // 3. Convertir le QR code en blob pour l'upload
  const qrBlob = await fetch(qrCodeDataUrl).then(r => r.blob());
  const qrFileName = `${user.id}/${ticketCode}_qr.png`;

  // 4. Upload du QR code vers Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('tickets-torp')
    .upload(qrFileName, qrBlob, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) {
    console.error('Erreur upload QR code:', uploadError);
    throw new Error('Impossible d\'enregistrer le QR code');
  }

  // 5. Récupérer l'URL publique du QR code
  const { data: { publicUrl: qrPublicUrl } } = supabase.storage
    .from('tickets-torp')
    .getPublicUrl(qrFileName);

  // 6. Mettre à jour l'analyse avec les infos du ticket
  const { error: updateError } = await supabase
    .from('pro_devis_analyses')
    .update({
      ticket_genere: true,
      ticket_code: ticketCode,
      ticket_url: publicUrl,
      ticket_generated_at: new Date().toISOString(),
    })
    .eq('id', analysisId);

  if (updateError) {
    console.error('Erreur mise à jour analyse:', updateError);
    throw new Error('Impossible de sauvegarder le ticket');
  }

  return {
    ticket_url: publicUrl,
    ticket_code: ticketCode,
    qr_code_url: qrPublicUrl,
  };
}

/**
 * Récupérer les événements de tracking d'un ticket
 */
export async function getTicketTracking(analysisId: string): Promise<TicketTrackingEvent[]> {
  const { data, error } = await supabase
    .from('ticket_tracking_events')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Récupérer une analyse via son ticket_code (pour la page publique)
 * Cette fonction est accessible sans authentification
 */
export async function getAnalysisByTicketCode(
  ticketCode: string
): Promise<ProDevisAnalysis | null> {
  const { data, error } = await supabase
    .from('pro_devis_analyses')
    .select('*')
    .eq('ticket_code', ticketCode)
    .eq('ticket_genere', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Enregistrer un événement de tracking de ticket
 * Cette fonction est accessible sans authentification (pour les visiteurs)
 */
export async function trackTicketView(
  ticketCode: string,
  eventType: 'qr_scanned' | 'link_viewed' | 'pdf_downloaded',
  metadata?: Record<string, any>
): Promise<void> {
  // Récupérer l'analyse via le ticket_code
  const analysis = await getAnalysisByTicketCode(ticketCode);

  if (!analysis) {
    throw new Error('Ticket not found');
  }

  // Créer un événement de tracking
  const { error: trackingError } = await supabase
    .from('ticket_tracking_events')
    .insert({
      analysis_id: analysis.id,
      event_type: eventType,
      metadata: metadata || {},
    });

  if (trackingError) {
    throw trackingError;
  }

  // Incrémenter le compteur de vues via la fonction SQL
  const { error: countError } = await supabase
    .rpc('increment_ticket_view_count', { p_analysis_id: analysis.id });

  if (countError) {
    console.error('Error incrementing view count:', countError);
  }
}
