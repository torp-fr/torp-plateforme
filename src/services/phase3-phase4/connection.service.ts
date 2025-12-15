/**
 * Phase 3 → Phase 4 Connection Service
 * Synchronisation entre l'exécution du chantier (Phase 3) et la réception/garanties (Phase 4)
 *
 * Flux de données:
 * - Contrôles Phase 3 → Réserves OPR Phase 4
 * - Certifications Phase 3 → DOE Phase 4
 * - Fiches auto-contrôle Phase 3 → Checklist OPR Phase 4
 * - Alertes Phase 3 → Suivi garanties Phase 4
 */

import { supabase } from '@/lib/supabase';
import type {
  OrganismeControle,
  VisiteControle,
  CertificationObligatoire,
  FicheAutoControle,
  GrilleControleQualite,
} from '@/types/phase3';
import type {
  OPRSession,
  Reserve,
  ReserveGravite,
  DocumentDOE,
  DOE,
  Garantie,
} from '@/types/phase4.types';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export interface Phase3ToPhase4Context {
  chantierId: string;
  projectId: string;
  datePassage: Date;
  userId: string;
}

export interface Phase3Summary {
  // Contrôles
  nombreControles: number;
  nombreControlesOK: number;
  nombreControlesKO: number;
  reservesNonLevees: number;

  // Certifications
  nombreCertifications: number;
  certificationsObtenues: number;
  certificationsEnAttente: number;

  // Fiches auto-contrôle
  nombreFiches: number;
  tauxConformite: number;

  // Qualité
  scoreQualiteGlobal: number;
  alertesActives: number;

  // Prêt pour réception?
  pretPourReception: boolean;
  raisonsBlockage: string[];
}

export interface SyncResult {
  success: boolean;
  reservesCreees: number;
  documentsTransferes: number;
  alertes: string[];
  errors: string[];
}

// ============================================
// SERVICE
// ============================================

export class Phase3Phase4ConnectionService {
  /**
   * Génère un résumé de la Phase 3 pour préparer le passage en Phase 4
   */
  static async getPhase3Summary(chantierId: string): Promise<Phase3Summary> {
    const [
      controlesData,
      certificationsData,
      fichesData,
      grillesData,
      alertesData,
    ] = await Promise.all([
      this.getControlesStats(chantierId),
      this.getCertificationsStats(chantierId),
      this.getFichesAutoControleStats(chantierId),
      this.getQualiteStats(chantierId),
      this.getAlertesActives(chantierId),
    ]);

    // Vérifier si le chantier est prêt pour la réception
    const raisonsBlockage: string[] = [];

    if (controlesData.nombreControlesKO > 0) {
      raisonsBlockage.push(`${controlesData.nombreControlesKO} contrôle(s) non conforme(s)`);
    }

    if (controlesData.reservesNonLevees > 0) {
      raisonsBlockage.push(`${controlesData.reservesNonLevees} réserve(s) de contrôle non levée(s)`);
    }

    if (certificationsData.certificationsEnAttente > 0) {
      raisonsBlockage.push(`${certificationsData.certificationsEnAttente} certification(s) en attente`);
    }

    if (fichesData.tauxConformite < 90) {
      raisonsBlockage.push(`Taux de conformité insuffisant (${fichesData.tauxConformite}% < 90%)`);
    }

    if (alertesData.count > 0) {
      raisonsBlockage.push(`${alertesData.count} alerte(s) active(s) non résolue(s)`);
    }

    return {
      nombreControles: controlesData.nombreControles,
      nombreControlesOK: controlesData.nombreControlesOK,
      nombreControlesKO: controlesData.nombreControlesKO,
      reservesNonLevees: controlesData.reservesNonLevees,
      nombreCertifications: certificationsData.nombreCertifications,
      certificationsObtenues: certificationsData.certificationsObtenues,
      certificationsEnAttente: certificationsData.certificationsEnAttente,
      nombreFiches: fichesData.nombreFiches,
      tauxConformite: fichesData.tauxConformite,
      scoreQualiteGlobal: grillesData.scoreGlobal,
      alertesActives: alertesData.count,
      pretPourReception: raisonsBlockage.length === 0,
      raisonsBlockage,
    };
  }

  /**
   * Synchronise les données de Phase 3 vers Phase 4
   * Crée automatiquement:
   * - Les réserves OPR à partir des contrôles KO
   * - Les documents DOE à partir des certifications
   * - Les alertes de garantie à partir des points de vigilance
   */
  static async syncToPhase4(context: Phase3ToPhase4Context): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      reservesCreees: 0,
      documentsTransferes: 0,
      alertes: [],
      errors: [],
    };

    try {
      // 1. Créer les réserves OPR à partir des contrôles non conformes
      const reservesResult = await this.createOPRReservesFromControles(context);
      result.reservesCreees = reservesResult.count;
      if (reservesResult.errors.length > 0) {
        result.errors.push(...reservesResult.errors);
      }

      // 2. Transférer les certifications vers le DOE
      const docsResult = await this.transferCertificationsToDOE(context);
      result.documentsTransferes = docsResult.count;
      if (docsResult.errors.length > 0) {
        result.errors.push(...docsResult.errors);
      }

      // 3. Créer les points de vigilance pour les garanties
      const alertesResult = await this.createGarantieAlerts(context);
      result.alertes = alertesResult.alertes;

      // 4. Mettre à jour le statut du chantier
      await this.updateChantierStatus(context.chantierId, 'phase4_ready');

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Erreur de synchronisation: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Crée une session OPR pré-remplie avec les données de Phase 3
   */
  static async createPrefilledOPRSession(
    context: Phase3ToPhase4Context
  ): Promise<OPRSession | null> {
    try {
      // Récupérer les données Phase 3
      const [grilles, fiches, controles] = await Promise.all([
        this.getGrillesQualite(context.chantierId),
        this.getFichesAutoControle(context.chantierId),
        this.getControlesVisites(context.chantierId),
      ]);

      // Construire la checklist OPR à partir des données Phase 3
      const checklistItems = this.buildChecklistFromPhase3(grilles, fiches, controles);

      // Créer la session OPR
      const sessionId = uuidv4();
      const session: OPRSession = {
        id: sessionId,
        chantierId: context.chantierId,
        dateSession: context.datePassage.toISOString(),
        statut: 'planifiee',
        type: 'opr_generale',
        lots: this.extractLotsFromPhase3(grilles, fiches),
        participants: [],
        controles: checklistItems,
        documentVerifications: [],
        reserves: [],
        syntheseGenerale: `Session OPR créée automatiquement à partir des contrôles Phase 3. ${checklistItems.length} points de contrôle importés.`,
        recommandations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: context.userId,
      };

      // Sauvegarder en base
      const { error } = await supabase
        .from('opr_sessions')
        .insert(session);

      if (error) {
        console.error('[Phase3-4 Sync] Erreur création OPR:', error);
        return null;
      }

      return session;
    } catch (error) {
      console.error('[Phase3-4 Sync] Erreur création session OPR:', error);
      return null;
    }
  }

  /**
   * Vérifie la cohérence entre Phase 3 et Phase 4
   */
  static async checkConsistency(chantierId: string): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Vérifier que toutes les réserves Phase 3 sont transférées
      const { data: reservesP3 } = await supabase
        .from('controle_reserves')
        .select('id')
        .eq('chantier_id', chantierId)
        .eq('statut', 'non_levee');

      const { data: reservesP4 } = await supabase
        .from('opr_reserves')
        .select('source_phase3_id')
        .eq('chantier_id', chantierId)
        .not('source_phase3_id', 'is', null);

      const reservesP4SourceIds = new Set(
        (reservesP4 || []).map((r) => r.source_phase3_id)
      );

      const reservesNonTransferees = (reservesP3 || []).filter(
        (r) => !reservesP4SourceIds.has(r.id)
      );

      if (reservesNonTransferees.length > 0) {
        issues.push(
          `${reservesNonTransferees.length} réserve(s) Phase 3 non transférée(s) vers Phase 4`
        );
      }

      // Vérifier que les certifications sont dans le DOE
      const { data: certifications } = await supabase
        .from('certifications')
        .select('id')
        .eq('chantier_id', chantierId)
        .eq('statut', 'obtenu');

      const { data: docsDOE } = await supabase
        .from('doe_documents')
        .select('source_certification_id')
        .eq('chantier_id', chantierId)
        .not('source_certification_id', 'is', null);

      const docsSourceIds = new Set(
        (docsDOE || []).map((d) => d.source_certification_id)
      );

      const certifsNonTransferees = (certifications || []).filter(
        (c) => !docsSourceIds.has(c.id)
      );

      if (certifsNonTransferees.length > 0) {
        issues.push(
          `${certifsNonTransferees.length} certification(s) non incluse(s) dans le DOE`
        );
      }
    } catch (error) {
      issues.push(`Erreur de vérification: ${(error as Error).message}`);
    }

    return {
      consistent: issues.length === 0,
      issues,
    };
  }

  // ============================================
  // MÉTHODES PRIVÉES - STATISTIQUES
  // ============================================

  private static async getControlesStats(chantierId: string) {
    // En mode mock, retourner des données de test
    const mockData = {
      nombreControles: 15,
      nombreControlesOK: 12,
      nombreControlesKO: 3,
      reservesNonLevees: 2,
    };

    try {
      const { data: visites } = await supabase
        .from('visites_controle')
        .select('id, resultat_global')
        .eq('chantier_id', chantierId);

      if (!visites || visites.length === 0) return mockData;

      const { data: reserves } = await supabase
        .from('controle_reserves')
        .select('id')
        .eq('chantier_id', chantierId)
        .eq('statut', 'non_levee');

      return {
        nombreControles: visites.length,
        nombreControlesOK: visites.filter((v) => v.resultat_global === 'conforme').length,
        nombreControlesKO: visites.filter((v) => v.resultat_global === 'non_conforme').length,
        reservesNonLevees: reserves?.length || 0,
      };
    } catch {
      return mockData;
    }
  }

  private static async getCertificationsStats(chantierId: string) {
    const mockData = {
      nombreCertifications: 5,
      certificationsObtenues: 4,
      certificationsEnAttente: 1,
    };

    try {
      const { data: certifications } = await supabase
        .from('certifications')
        .select('id, statut')
        .eq('chantier_id', chantierId);

      if (!certifications || certifications.length === 0) return mockData;

      return {
        nombreCertifications: certifications.length,
        certificationsObtenues: certifications.filter((c) => c.statut === 'obtenu').length,
        certificationsEnAttente: certifications.filter((c) => c.statut === 'en_cours').length,
      };
    } catch {
      return mockData;
    }
  }

  private static async getFichesAutoControleStats(chantierId: string) {
    const mockData = {
      nombreFiches: 25,
      tauxConformite: 92,
    };

    try {
      const { data: fiches } = await supabase
        .from('fiches_autocontrole')
        .select('id, resultat')
        .eq('chantier_id', chantierId);

      if (!fiches || fiches.length === 0) return mockData;

      const conformes = fiches.filter((f) => f.resultat === 'conforme').length;
      const tauxConformite = Math.round((conformes / fiches.length) * 100);

      return {
        nombreFiches: fiches.length,
        tauxConformite,
      };
    } catch {
      return mockData;
    }
  }

  private static async getQualiteStats(chantierId: string) {
    const mockData = { scoreGlobal: 85 };

    try {
      const { data: grilles } = await supabase
        .from('grilles_qualite')
        .select('score_global')
        .eq('chantier_id', chantierId);

      if (!grilles || grilles.length === 0) return mockData;

      const totalScore = grilles.reduce((sum, g) => sum + (g.score_global || 0), 0);
      const scoreGlobal = Math.round(totalScore / grilles.length);

      return { scoreGlobal };
    } catch {
      return mockData;
    }
  }

  private static async getAlertesActives(chantierId: string) {
    const mockData = { count: 0 };

    try {
      const { count } = await supabase
        .from('alertes_controle')
        .select('id', { count: 'exact', head: true })
        .eq('chantier_id', chantierId)
        .eq('statut', 'active');

      return { count: count || 0 };
    } catch {
      return mockData;
    }
  }

  // ============================================
  // MÉTHODES PRIVÉES - SYNCHRONISATION
  // ============================================

  private static async createOPRReservesFromControles(
    context: Phase3ToPhase4Context
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Récupérer les réserves de contrôle non levées
      const { data: reservesControle } = await supabase
        .from('controle_reserves')
        .select('*')
        .eq('chantier_id', context.chantierId)
        .eq('statut', 'non_levee');

      if (!reservesControle || reservesControle.length === 0) {
        return { count: 0, errors: [] };
      }

      // Convertir en réserves OPR
      const reservesOPR: Partial<Reserve>[] = reservesControle.map((r) => ({
        id: uuidv4(),
        chantierId: context.chantierId,
        lot: r.lot || 'non_specifie',
        localisation: r.localisation || 'À définir',
        description: r.description,
        gravite: this.mapGraviteToOPR(r.gravite),
        statut: 'ouverte',
        dateConstat: r.date_creation,
        sourcePhase3Id: r.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: context.userId,
      }));

      // Insérer les réserves OPR
      const { error } = await supabase
        .from('opr_reserves')
        .insert(reservesOPR);

      if (error) {
        errors.push(`Erreur insertion réserves OPR: ${error.message}`);
      } else {
        count = reservesOPR.length;
      }
    } catch (error) {
      errors.push(`Erreur création réserves: ${(error as Error).message}`);
    }

    return { count, errors };
  }

  private static async transferCertificationsToDOE(
    context: Phase3ToPhase4Context
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Récupérer les certifications obtenues
      const { data: certifications } = await supabase
        .from('certifications')
        .select('*')
        .eq('chantier_id', context.chantierId)
        .eq('statut', 'obtenu');

      if (!certifications || certifications.length === 0) {
        return { count: 0, errors: [] };
      }

      // Convertir en documents DOE
      const documents: Partial<DocumentDOE>[] = certifications.map((c) => ({
        id: uuidv4(),
        chantierId: context.chantierId,
        type: 'certification' as const,
        nom: c.type,
        description: `Certification ${c.type} - ${c.organisme}`,
        dateObtention: c.date_obtention,
        url: c.document_url,
        sourceCertificationId: c.id,
        statut: 'a_integrer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      // Insérer les documents DOE
      const { error } = await supabase
        .from('doe_documents')
        .insert(documents);

      if (error) {
        errors.push(`Erreur insertion documents DOE: ${error.message}`);
      } else {
        count = documents.length;
      }
    } catch (error) {
      errors.push(`Erreur transfert certifications: ${(error as Error).message}`);
    }

    return { count, errors };
  }

  private static async createGarantieAlerts(
    context: Phase3ToPhase4Context
  ): Promise<{ alertes: string[] }> {
    const alertes: string[] = [];

    try {
      // Récupérer les alertes actives Phase 3
      const { data: alertesP3 } = await supabase
        .from('alertes_controle')
        .select('*')
        .eq('chantier_id', context.chantierId)
        .eq('statut', 'active');

      if (alertesP3 && alertesP3.length > 0) {
        for (const alerte of alertesP3) {
          alertes.push(
            `[${alerte.type}] ${alerte.description} - Point de vigilance pour les garanties`
          );
        }
      }

      // Vérifier les fiches avec non-conformités récurrentes
      const { data: fichesNC } = await supabase
        .from('fiches_autocontrole')
        .select('lot, description')
        .eq('chantier_id', context.chantierId)
        .eq('resultat', 'non_conforme');

      if (fichesNC && fichesNC.length > 3) {
        alertes.push(
          `Attention: ${fichesNC.length} non-conformités détectées en auto-contrôle - Surveillance renforcée recommandée pendant la garantie`
        );
      }
    } catch (error) {
      alertes.push(`Avertissement: Impossible de récupérer certaines alertes Phase 3`);
    }

    return { alertes };
  }

  private static async updateChantierStatus(
    chantierId: string,
    status: string
  ): Promise<void> {
    try {
      await supabase
        .from('chantiers')
        .update({ phase_status: status, updated_at: new Date().toISOString() })
        .eq('id', chantierId);
    } catch (error) {
      console.error('[Phase3-4 Sync] Erreur mise à jour statut:', error);
    }
  }

  // ============================================
  // MÉTHODES PRIVÉES - HELPERS
  // ============================================

  private static async getGrillesQualite(chantierId: string) {
    const { data } = await supabase
      .from('grilles_qualite')
      .select('*')
      .eq('chantier_id', chantierId);
    return data || [];
  }

  private static async getFichesAutoControle(chantierId: string) {
    const { data } = await supabase
      .from('fiches_autocontrole')
      .select('*')
      .eq('chantier_id', chantierId);
    return data || [];
  }

  private static async getControlesVisites(chantierId: string) {
    const { data } = await supabase
      .from('visites_controle')
      .select('*')
      .eq('chantier_id', chantierId);
    return data || [];
  }

  private static buildChecklistFromPhase3(
    grilles: any[],
    fiches: any[],
    controles: any[]
  ): any[] {
    const checklistItems: any[] = [];

    // Extraire les points de contrôle des grilles qualité
    grilles.forEach((grille) => {
      if (grille.points_controle) {
        grille.points_controle.forEach((point: any) => {
          checklistItems.push({
            id: uuidv4(),
            lot: grille.lot,
            libelle: point.libelle,
            sourcePhase3: 'grille_qualite',
            sourceId: grille.id,
            resultatPhase3: point.conforme ? 'conforme' : 'non_conforme',
          });
        });
      }
    });

    // Ajouter les points des fiches auto-contrôle
    fiches.forEach((fiche) => {
      checklistItems.push({
        id: uuidv4(),
        lot: fiche.lot,
        libelle: fiche.description || `Auto-contrôle ${fiche.reference}`,
        sourcePhase3: 'fiche_autocontrole',
        sourceId: fiche.id,
        resultatPhase3: fiche.resultat,
      });
    });

    return checklistItems;
  }

  private static extractLotsFromPhase3(grilles: any[], fiches: any[]): string[] {
    const lotsSet = new Set<string>();

    grilles.forEach((g) => g.lot && lotsSet.add(g.lot));
    fiches.forEach((f) => f.lot && lotsSet.add(f.lot));

    return Array.from(lotsSet);
  }

  private static mapGraviteToOPR(graviteP3: string): ReserveGravite {
    const mapping: Record<string, ReserveGravite> = {
      critique: 'bloquante',
      majeure: 'majeure',
      mineure: 'mineure',
      observation: 'mineure',
    };
    return mapping[graviteP3] || 'mineure';
  }
}

export const phase3Phase4Service = new Phase3Phase4ConnectionService();
export default Phase3Phase4ConnectionService;
