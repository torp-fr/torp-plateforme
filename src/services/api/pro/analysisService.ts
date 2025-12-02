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

  // 3. Déclencher l'analyse du devis
  try {
    const { analyzeProDevis } = await import('@/lib/pro/analysis');

    // Lancer l'analyse en arrière-plan (async, ne pas attendre)
    analyzeProDevis(analysis.id).catch((error) => {
      console.error('[createAnalysis] Analysis failed:', error);
    });

    // Retourner immédiatement l'analyse en status PENDING
    return analysis;
  } catch (error) {
    console.error('[createAnalysis] Failed to trigger analysis:', error);
    throw error;
  }
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
 * Générer un ticket TORP (badge de certification PDF)
 * Utilise le nouveau système de génération complet
 */
export async function generateTicket(analysisId: string): Promise<{
  ticket_code: string;
  short_code: string;
  ticket_url: string;
  pdf_url: string;
  pdf_file_name: string;
}> {
  // Utiliser le service de génération complet de tickets
  const { generateTicket: generateTicketService } = await import('@/lib/pro/ticket/ticket-service');

  try {
    const result = await generateTicketService(analysisId);

    return {
      ticket_code: result.ticketCode,
      short_code: result.shortCode,
      ticket_url: result.ticketUrl,
      pdf_url: result.pdfUrl,
      pdf_file_name: result.pdfFileName,
    };
  } catch (error) {
    console.error('[generateTicket] Error:', error);
    throw error;
  }
}

/**
 * Récupérer les informations d'un ticket existant
 */
export async function getTicketInfo(analysisId: string): Promise<{
  ticket_code: string;
  short_code: string;
  ticket_url: string;
  pdf_url: string;
  pdf_file_name: string;
} | null> {
  const { getTicketInfo: getTicketInfoService } = await import('@/lib/pro/ticket/ticket-service');

  try {
    return await getTicketInfoService(analysisId);
  } catch (error) {
    console.error('[getTicketInfo] Error:', error);
    return null;
  }
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

/**
 * Interface pour les données publiques du ticket
 */
export interface PublicTicketData {
  valid: boolean;
  error?: string;
  data?: {
    ticketCode: string;
    grade: 'A' | 'B' | 'C' | 'D' | 'E';
    scoreTotal: number;
    gradeLabel: string;
    gradeDescription: string;
    entreprise: {
      raisonSociale: string;
      ville: string;
      siretPartiel: string;
      anciennete: string;
      siretVerifie: boolean;
    };
    referenceDevis: string;
    dateAnalyse: string;
    axes: Array<{
      label: string;
      score: number;
      status: 'excellent' | 'bon' | 'moyen' | 'faible';
    }>;
    pointsForts: string[];
    documentsVerifies: Array<{
      type: string;
      statut: 'valide' | 'present';
    }>;
    certifications: string[];
  };
}

/**
 * Récupère les données publiques d'un ticket pour affichage
 * Fonction accessible sans authentification
 */
export async function getPublicTicketData(ticketCode: string): Promise<PublicTicketData> {
  try {
    // Validation du format
    if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(ticketCode.toUpperCase())) {
      return {
        valid: false,
        error: 'Code invalide',
      };
    }

    const code = ticketCode.toUpperCase();

    // Récupérer l'analyse
    const { data: analysis, error: analysisError } = await supabase
      .from('pro_devis_analyses')
      .select(`
        *,
        company:pro_company_profiles!inner(
          raison_sociale,
          ville,
          siret,
          siret_verifie,
          date_creation
        )
      `)
      .eq('ticket_code', code)
      .eq('ticket_genere', true)
      .eq('status', 'COMPLETED')
      .single();

    if (analysisError || !analysis) {
      return {
        valid: false,
        error: 'Ticket non trouvé',
      };
    }

    // Récupérer les documents
    const { data: documents } = await supabase
      .from('company_documents')
      .select('*')
      .eq('company_id', analysis.company_id)
      .in('statut', ['VALID', 'EXPIRING']);

    // Formater les données
    const gradeInfo = getGradeInfo(analysis.grade);
    const axes = formatAxesForPublic(analysis.score_details);
    const pointsForts = extractPointsForts(analysis.score_details);
    const documentsVerifies = formatDocuments(documents || []);
    const certifications = extractCertifications(documents || []);

    return {
      valid: true,
      data: {
        ticketCode: `TORP-${code}`,
        grade: analysis.grade as 'A' | 'B' | 'C' | 'D' | 'E',
        scoreTotal: analysis.score_total || 0,
        gradeLabel: gradeInfo.label,
        gradeDescription: gradeInfo.description,
        entreprise: {
          raisonSociale: analysis.company.raison_sociale,
          ville: analysis.company.ville || 'Non renseigné',
          siretPartiel: formatSiret(analysis.company.siret),
          anciennete: calculateAnciennete(analysis.company.date_creation),
          siretVerifie: analysis.company.siret_verifie || false,
        },
        referenceDevis: analysis.reference_devis || 'Non renseigné',
        dateAnalyse: formatDateFr(analysis.analyzed_at),
        axes,
        pointsForts,
        documentsVerifies,
        certifications,
      },
    };
  } catch (error) {
    console.error('Error fetching public ticket data:', error);
    return {
      valid: false,
      error: 'Erreur serveur',
    };
  }
}

// Helper functions

function getGradeInfo(grade: string | null): { label: string; description: string } {
  const grades: Record<string, { label: string; description: string }> = {
    A: {
      label: 'Excellent',
      description: 'Ce devis présente toutes les garanties de qualité et de professionnalisme.',
    },
    B: {
      label: 'Bon',
      description: 'Ce devis est de bonne qualité avec des garanties solides.',
    },
    C: {
      label: 'Correct',
      description: 'Ce devis est acceptable mais présente quelques points d\'attention.',
    },
    D: {
      label: 'Insuffisant',
      description: 'Ce devis présente des lacunes importantes à clarifier avant engagement.',
    },
    E: {
      label: 'Critique',
      description: 'Ce devis présente des problèmes majeurs. Prudence recommandée.',
    },
  };
  return grades[grade || 'C'] || grades.C;
}

function formatAxesForPublic(scoreDetails: any): Array<{ label: string; score: number; status: string }> {
  if (!scoreDetails) return [];

  const axeLabels: Record<string, string> = {
    fiabilite: 'Fiabilité entreprise',
    assurances: 'Assurances',
    tarifs: 'Transparence tarifaire',
    qualite: 'Qualité du devis',
    conformite: 'Conformité légale',
    transparence: 'Transparence',
  };

  return Object.entries(scoreDetails)
    .filter(([key]) => axeLabels[key])
    .map(([key, value]: [string, any]) => {
      const pointsObtenus = value?.points_obtenus || value?.pointsObtenus || 0;
      const maxPoints = value?.max_points || value?.maxPoints || 100;
      const pourcentage = Math.round((pointsObtenus / maxPoints) * 100);

      let status: 'excellent' | 'bon' | 'moyen' | 'faible' = 'moyen';
      if (pourcentage >= 80) status = 'excellent';
      else if (pourcentage >= 60) status = 'bon';
      else if (pourcentage < 40) status = 'faible';

      return {
        label: axeLabels[key],
        score: pourcentage,
        status,
      };
    });
}

function extractPointsForts(scoreDetails: any): string[] {
  const points: string[] = [];

  if (!scoreDetails) return points;

  // Extraire les points forts basés sur les scores
  const assurances = scoreDetails.assurances || scoreDetails.Assurances;
  const fiabilite = scoreDetails.fiabilite || scoreDetails.Fiabilité;
  const qualite = scoreDetails.qualite || scoreDetails.Qualité;
  const conformite = scoreDetails.conformite || scoreDetails.Conformité;
  const tarifs = scoreDetails.tarifs || scoreDetails.Tarifs;

  if (assurances && (assurances.points_obtenus || assurances.pointsObtenus) >= 160) {
    points.push('Assurances vérifiées et à jour');
  }
  if (fiabilite && (fiabilite.points_obtenus || fiabilite.pointsObtenus) >= 200) {
    points.push('Entreprise établie et fiable');
  }
  if (qualite && (qualite.points_obtenus || qualite.pointsObtenus) >= 120) {
    points.push('Devis clair et détaillé');
  }
  if (conformite && (conformite.points_obtenus || conformite.pointsObtenus) >= 100) {
    points.push('Mentions légales conformes');
  }
  if (tarifs && (tarifs.points_obtenus || tarifs.pointsObtenus) >= 160) {
    points.push('Tarification transparente');
  }

  return points.slice(0, 3);
}

function formatDocuments(documents: any[]): Array<{ type: string; statut: string }> {
  const docLabels: Record<string, string> = {
    KBIS: 'Extrait Kbis',
    ASSURANCE_DECENNALE: 'Assurance décennale',
    ASSURANCE_RC_PRO: 'RC Professionnelle',
    ATTESTATION_URSSAF: 'Attestation URSSAF',
    CERTIFICATION_RGE: 'Certification RGE',
    CERTIFICATION_QUALIBAT: 'Certification Qualibat',
  };

  return documents
    .filter((doc) =>
      ['KBIS', 'ASSURANCE_DECENNALE', 'ASSURANCE_RC_PRO', 'CERTIFICATION_RGE', 'CERTIFICATION_QUALIBAT'].includes(
        doc.type
      )
    )
    .map((doc) => ({
      type: docLabels[doc.type] || doc.type,
      statut: doc.statut === 'VALID' ? 'valide' : 'present',
    }));
}

function extractCertifications(documents: any[]): string[] {
  const certifTypes = ['CERTIFICATION_RGE', 'CERTIFICATION_QUALIBAT', 'CERTIFICATION_QUALIFELEC', 'CERTIFICATION_QUALIPAC'];
  return documents
    .filter((doc) => certifTypes.includes(doc.type) && doc.statut === 'VALID')
    .map((doc) => doc.type.replace('CERTIFICATION_', ''));
}

function formatSiret(siret: string): string {
  const clean = siret.replace(/\s/g, '');
  if (clean.length !== 14) return siret;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
}

function calculateAnciennete(dateCreation: string | null): string {
  if (!dateCreation) return 'Non renseigné';
  const years = Math.floor((Date.now() - new Date(dateCreation).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) return 'Moins d\'un an';
  if (years === 1) return '1 an d\'activité';
  return `${years} ans d'activité`;
}

function formatDateFr(date: string | null): string {
  if (!date) return 'Non renseigné';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
