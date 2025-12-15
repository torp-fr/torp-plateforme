/**
 * TORP Phase 2 - Logistique Service
 * Gestion installation chantier, approvisionnements, documents, journal
 */

import { supabase } from '@/lib/supabase';
import type {
  InstallationChantier,
  Approvisionnement,
  Dechet,
  DocumentChantier,
  JournalChantier,
  ChecklistDemarrage,
  ChecklistItem,
  CreateApprovisionnementInput,
  CreateDocumentInput,
  CreateJournalInput,
  StatutInstallation,
  StatutApprovisionnement,
  StatutDocumentChantier,
  TypeDocumentChantier,
  CHECKLIST_DEMARRAGE_ITEMS,
} from '@/types/phase2';

export interface DocumentFilters {
  chantierId?: string;
  type?: TypeDocumentChantier;
  statut?: StatutDocumentChantier;
}

export class LogistiqueService {
  // ============================================
  // INSTALLATION CHANTIER
  // ============================================

  /**
   * Créer l'installation chantier initiale
   */
  static async createInstallation(chantierId: string): Promise<InstallationChantier> {
    const defaultInstallation = {
      chantier_id: chantierId,
      base_vie: {
        vestiaires: { prevu: false, installe: false, surfaceM2: 0 },
        sanitaires: { prevu: false, installe: false, type: '' },
        refectoire: { prevu: false, installe: false, equipements: [] },
        bureauChantier: { prevu: false, installe: false },
      },
      branchements: {
        electricite: { demande: false, raccorde: false, puissanceKw: 0 },
        eau: { demande: false, raccorde: false },
        assainissement: { prevu: false, installe: false },
      },
      zones: {
        stockageMateriaux: [],
        stockageDechets: [],
        circulationEngins: [],
        stationnement: [],
      },
      signalisation: {
        panneauChantier: false,
        panneauEntreprise: false,
        consignesSecurite: false,
        planEvacuation: false,
        balisagePerimetre: false,
      },
      securite: {
        extincteurs: { nombre: 0, emplacements: [] },
        trousseSecours: false,
        numerosUrgenceAffiches: false,
        registreSecurite: false,
      },
      statut: 'a_preparer',
      checklist_completude: 0,
    };

    const { data, error } = await supabase
      .from('phase2_installation_chantier')
      .insert(defaultInstallation)
      .select()
      .single();

    if (error) throw error;
    return this.mapToInstallation(data);
  }

  /**
   * Récupérer l'installation d'un chantier
   */
  static async getInstallation(chantierId: string): Promise<InstallationChantier | null> {
    const { data, error } = await supabase
      .from('phase2_installation_chantier')
      .select('*')
      .eq('chantier_id', chantierId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToInstallation(data);
  }

  /**
   * Mettre à jour l'installation
   */
  static async updateInstallation(
    chantierId: string,
    updates: Partial<InstallationChantier>
  ): Promise<InstallationChantier> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.baseVie !== undefined) dbUpdates.base_vie = updates.baseVie;
    if (updates.branchements !== undefined) dbUpdates.branchements = updates.branchements;
    if (updates.zones !== undefined) dbUpdates.zones = updates.zones;
    if (updates.signalisation !== undefined) dbUpdates.signalisation = updates.signalisation;
    if (updates.securite !== undefined) dbUpdates.securite = updates.securite;
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut;
    if (updates.planInstallationUrl !== undefined) dbUpdates.plan_installation_url = updates.planInstallationUrl;

    // Recalculer le % de complétude
    dbUpdates.checklist_completude = await this.calculateInstallationCompletude(chantierId, updates);
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('phase2_installation_chantier')
      .update(dbUpdates)
      .eq('chantier_id', chantierId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToInstallation(data);
  }

  /**
   * Calculer le % de complétude de l'installation
   */
  private static async calculateInstallationCompletude(
    chantierId: string,
    updates?: Partial<InstallationChantier>
  ): Promise<number> {
    let installation = await this.getInstallation(chantierId);
    if (!installation) return 0;

    // Merger les updates
    if (updates) {
      installation = { ...installation, ...updates };
    }

    let total = 0;
    let completed = 0;

    // Base vie
    const bv = installation.baseVie;
    if (bv.vestiaires.prevu) { total++; if (bv.vestiaires.installe) completed++; }
    if (bv.sanitaires.prevu) { total++; if (bv.sanitaires.installe) completed++; }
    if (bv.refectoire.prevu) { total++; if (bv.refectoire.installe) completed++; }
    if (bv.bureauChantier.prevu) { total++; if (bv.bureauChantier.installe) completed++; }

    // Branchements
    const br = installation.branchements;
    if (br.electricite.demande) { total++; if (br.electricite.raccorde) completed++; }
    if (br.eau.demande) { total++; if (br.eau.raccorde) completed++; }
    if (br.assainissement.prevu) { total++; if (br.assainissement.installe) completed++; }

    // Signalisation (tous obligatoires)
    const sig = installation.signalisation;
    total += 5;
    if (sig.panneauChantier) completed++;
    if (sig.panneauEntreprise) completed++;
    if (sig.consignesSecurite) completed++;
    if (sig.planEvacuation) completed++;
    if (sig.balisagePerimetre) completed++;

    // Sécurité
    const sec = installation.securite;
    total += 4;
    if (sec.extincteurs.nombre > 0) completed++;
    if (sec.trousseSecours) completed++;
    if (sec.numerosUrgenceAffiches) completed++;
    if (sec.registreSecurite) completed++;

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  // ============================================
  // APPROVISIONNEMENTS
  // ============================================

  /**
   * Créer un approvisionnement
   */
  static async createApprovisionnement(input: CreateApprovisionnementInput): Promise<Approvisionnement> {
    const { data, error } = await supabase
      .from('phase2_approvisionnements')
      .insert({
        chantier_id: input.chantierId,
        tache_id: input.tacheId,
        designation: input.designation,
        reference: input.reference,
        fournisseur: input.fournisseur,
        quantite: input.quantite,
        unite: input.unite,
        date_livraison_prevue: input.dateLivraisonPrevue,
        delai_fabrication_jours: input.delaiFabricationJours,
        statut: 'a_commander',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToApprovisionnement(data);
  }

  /**
   * Lister les approvisionnements d'un chantier
   */
  static async getApprovisionnements(chantierId: string): Promise<Approvisionnement[]> {
    const { data, error } = await supabase
      .from('phase2_approvisionnements')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('date_livraison_prevue', { ascending: true });

    if (error) throw error;
    return (data || []).map(a => this.mapToApprovisionnement(a));
  }

  /**
   * Mettre à jour le statut d'un approvisionnement
   */
  static async updateApprovisionnementStatut(
    id: string,
    statut: StatutApprovisionnement,
    controleReception?: Approvisionnement['controleReception']
  ): Promise<Approvisionnement> {
    const updates: Record<string, unknown> = {
      statut,
      updated_at: new Date().toISOString(),
    };

    if (statut === 'commande') {
      updates.date_commande = new Date().toISOString().split('T')[0];
    }

    if (statut === 'livre') {
      updates.date_livraison_reelle = new Date().toISOString().split('T')[0];
    }

    if (controleReception && (statut === 'conforme' || statut === 'non_conforme')) {
      updates.controle_reception = controleReception;
    }

    const { data, error } = await supabase
      .from('phase2_approvisionnements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToApprovisionnement(data);
  }

  /**
   * Approvisionnements en retard
   */
  static async getApprovisionnementsEnRetard(chantierId: string): Promise<Approvisionnement[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('phase2_approvisionnements')
      .select('*')
      .eq('chantier_id', chantierId)
      .lt('date_livraison_prevue', today)
      .in('statut', ['a_commander', 'commande', 'en_fabrication', 'expedie']);

    if (error) throw error;
    return (data || []).map(a => this.mapToApprovisionnement(a));
  }

  // ============================================
  // DOCUMENTS CHANTIER
  // ============================================

  /**
   * Créer un document chantier
   */
  static async createDocument(input: CreateDocumentInput): Promise<DocumentChantier> {
    const { data, error } = await supabase
      .from('phase2_documents_chantier')
      .insert({
        chantier_id: input.chantierId,
        type: input.type,
        nom: input.nom,
        description: input.description,
        date_expiration: input.dateExpiration,
        fourni_par: input.fourniPar,
        statut: 'a_fournir',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToDocument(data);
  }

  /**
   * Lister les documents d'un chantier
   */
  static async getDocuments(filters?: DocumentFilters): Promise<DocumentChantier[]> {
    let query = supabase
      .from('phase2_documents_chantier')
      .select('*')
      .order('type', { ascending: true });

    if (filters?.chantierId) {
      query = query.eq('chantier_id', filters.chantierId);
    }

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.statut) {
      query = query.eq('statut', filters.statut);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(d => this.mapToDocument(d));
  }

  /**
   * Mettre à jour un document
   */
  static async updateDocument(
    id: string,
    updates: Partial<DocumentChantier>
  ): Promise<DocumentChantier> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.nom !== undefined) dbUpdates.nom = updates.nom;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.fileUrl !== undefined) dbUpdates.file_url = updates.fileUrl;
    if (updates.fileName !== undefined) dbUpdates.file_name = updates.fileName;
    if (updates.dateEmission !== undefined) dbUpdates.date_emission = updates.dateEmission;
    if (updates.dateExpiration !== undefined) dbUpdates.date_expiration = updates.dateExpiration;
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut;
    if (updates.fourniPar !== undefined) dbUpdates.fourni_par = updates.fourniPar;
    if (updates.verifieLe !== undefined) dbUpdates.verifie_le = updates.verifieLe;
    if (updates.verifiePar !== undefined) dbUpdates.verifie_par = updates.verifiePar;
    if (updates.commentaireVerification !== undefined) dbUpdates.commentaire_verification = updates.commentaireVerification;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('phase2_documents_chantier')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToDocument(data);
  }

  /**
   * Valider un document
   */
  static async validerDocument(id: string, validePar: string): Promise<DocumentChantier> {
    return this.updateDocument(id, {
      statut: 'valide',
      verifieLe: new Date().toISOString().split('T')[0],
      verifiePar: validePar,
    });
  }

  /**
   * Documents manquants ou expirés
   */
  static async getDocumentsAlertes(chantierId: string): Promise<DocumentChantier[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('phase2_documents_chantier')
      .select('*')
      .eq('chantier_id', chantierId)
      .or(`statut.eq.a_fournir,statut.eq.expire,date_expiration.lt.${today}`);

    if (error) throw error;
    return (data || []).map(d => this.mapToDocument(d));
  }

  // ============================================
  // JOURNAL CHANTIER
  // ============================================

  /**
   * Créer une entrée de journal
   */
  static async createJournal(input: CreateJournalInput): Promise<JournalChantier> {
    const effectifTotal = (input.effectifs || []).reduce((sum, e) => sum + e.nombrePersonnes, 0);

    const { data, error } = await supabase
      .from('phase2_journal_chantier')
      .insert({
        chantier_id: input.chantierId,
        date_journal: input.dateJournal,
        meteo: input.meteo || { matin: '', apresMidi: '', intemperie: false },
        effectifs: input.effectifs || [],
        effectif_total: effectifTotal,
        travaux_realises: input.travauxRealises || [],
        observations: input.observations,
        incidents: input.incidents,
        visiteurs: [],
        photos: [],
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToJournal(data);
  }

  /**
   * Récupérer le journal d'une date
   */
  static async getJournalByDate(chantierId: string, date: string): Promise<JournalChantier | null> {
    const { data, error } = await supabase
      .from('phase2_journal_chantier')
      .select('*')
      .eq('chantier_id', chantierId)
      .eq('date_journal', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToJournal(data);
  }

  /**
   * Lister les entrées de journal
   */
  static async getJournaux(chantierId: string, limit?: number): Promise<JournalChantier[]> {
    let query = supabase
      .from('phase2_journal_chantier')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('date_journal', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(j => this.mapToJournal(j));
  }

  /**
   * Mettre à jour une entrée de journal
   */
  static async updateJournal(id: string, updates: Partial<JournalChantier>): Promise<JournalChantier> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.meteo !== undefined) dbUpdates.meteo = updates.meteo;
    if (updates.effectifs !== undefined) {
      dbUpdates.effectifs = updates.effectifs;
      dbUpdates.effectif_total = updates.effectifs.reduce((sum, e) => sum + e.nombrePersonnes, 0);
    }
    if (updates.travauxRealises !== undefined) dbUpdates.travaux_realises = updates.travauxRealises;
    if (updates.observations !== undefined) dbUpdates.observations = updates.observations;
    if (updates.incidents !== undefined) dbUpdates.incidents = updates.incidents;
    if (updates.visiteurs !== undefined) dbUpdates.visiteurs = updates.visiteurs;
    if (updates.photos !== undefined) dbUpdates.photos = updates.photos;
    if (updates.validePar !== undefined) dbUpdates.valide_par = updates.validePar;
    if (updates.valideLe !== undefined) dbUpdates.valide_le = updates.valideLe;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('phase2_journal_chantier')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToJournal(data);
  }

  // ============================================
  // CHECKLIST DÉMARRAGE
  // ============================================

  /**
   * Créer la checklist de démarrage
   */
  static async createChecklist(chantierId: string): Promise<ChecklistDemarrage> {
    // Import du template
    const { CHECKLIST_DEMARRAGE_ITEMS } = await import('@/types/phase2');

    const items: ChecklistItem[] = CHECKLIST_DEMARRAGE_ITEMS.map(item => ({
      id: crypto.randomUUID(),
      categorie: item.categorie,
      libelle: item.libelle,
      obligatoire: item.obligatoire,
      valide: false,
    }));

    const { data, error } = await supabase
      .from('phase2_checklist_demarrage')
      .insert({
        chantier_id: chantierId,
        items,
        items_total: items.length,
        items_valides: 0,
        pourcentage_completion: 0,
        est_complet: false,
        peut_demarrer: false,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToChecklist(data);
  }

  /**
   * Récupérer la checklist d'un chantier
   */
  static async getChecklist(chantierId: string): Promise<ChecklistDemarrage | null> {
    const { data, error } = await supabase
      .from('phase2_checklist_demarrage')
      .select('*')
      .eq('chantier_id', chantierId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapToChecklist(data);
  }

  /**
   * Mettre à jour un item de la checklist
   */
  static async updateChecklistItem(
    chantierId: string,
    itemId: string,
    valide: boolean,
    commentaire?: string,
    documentUrl?: string
  ): Promise<ChecklistDemarrage> {
    const checklist = await this.getChecklist(chantierId);
    if (!checklist) throw new Error('Checklist non trouvée');

    const updatedItems = checklist.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          valide,
          commentaire,
          documentUrl,
          dateValidation: valide ? new Date().toISOString() : undefined,
        };
      }
      return item;
    });

    const itemsValides = updatedItems.filter(i => i.valide).length;
    const pourcentageCompletion = Math.round((itemsValides / updatedItems.length) * 100);
    const itemsObligatoiresNonValides = updatedItems.filter(i => i.obligatoire && !i.valide).length;

    const { data, error } = await supabase
      .from('phase2_checklist_demarrage')
      .update({
        items: updatedItems,
        items_valides: itemsValides,
        pourcentage_completion: pourcentageCompletion,
        est_complet: itemsValides === updatedItems.length,
        peut_demarrer: itemsObligatoiresNonValides === 0,
        updated_at: new Date().toISOString(),
      })
      .eq('chantier_id', chantierId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToChecklist(data);
  }

  /**
   * Valider la checklist complète
   */
  static async validerChecklist(chantierId: string, validePar: string): Promise<ChecklistDemarrage> {
    const checklist = await this.getChecklist(chantierId);
    if (!checklist) throw new Error('Checklist non trouvée');
    if (!checklist.peutDemarrer) throw new Error('Items obligatoires manquants');

    const { data, error } = await supabase
      .from('phase2_checklist_demarrage')
      .update({
        valide_par: validePar,
        valide_le: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('chantier_id', chantierId)
      .select()
      .single();

    if (error) throw error;
    return this.mapToChecklist(data);
  }

  // ============================================
  // MAPPERS
  // ============================================

  private static mapToInstallation(data: Record<string, unknown>): InstallationChantier {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      baseVie: data.base_vie as InstallationChantier['baseVie'],
      branchements: data.branchements as InstallationChantier['branchements'],
      zones: data.zones as InstallationChantier['zones'],
      signalisation: data.signalisation as InstallationChantier['signalisation'],
      securite: data.securite as InstallationChantier['securite'],
      statut: data.statut as StatutInstallation,
      checklistCompletude: (data.checklist_completude as number) || 0,
      planInstallationUrl: data.plan_installation_url as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private static mapToApprovisionnement(data: Record<string, unknown>): Approvisionnement {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      tacheId: data.tache_id as string | undefined,
      designation: data.designation as string,
      reference: data.reference as string | undefined,
      fournisseur: data.fournisseur as string | undefined,
      quantite: data.quantite as number,
      unite: data.unite as string | undefined,
      dateCommande: data.date_commande as string | undefined,
      delaiFabricationJours: data.delai_fabrication_jours as number | undefined,
      dateLivraisonPrevue: data.date_livraison_prevue as string | undefined,
      dateLivraisonReelle: data.date_livraison_reelle as string | undefined,
      statut: data.statut as StatutApprovisionnement,
      controleReception: data.controle_reception as Approvisionnement['controleReception'],
      bonCommandeUrl: data.bon_commande_url as string | undefined,
      bonLivraisonUrl: data.bon_livraison_url as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private static mapToDocument(data: Record<string, unknown>): DocumentChantier {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      type: data.type as TypeDocumentChantier,
      nom: data.nom as string,
      description: data.description as string | undefined,
      fileUrl: data.file_url as string | undefined,
      fileName: data.file_name as string | undefined,
      dateEmission: data.date_emission as string | undefined,
      dateExpiration: data.date_expiration as string | undefined,
      statut: data.statut as StatutDocumentChantier,
      fourniPar: data.fourni_par as string | undefined,
      verifieLe: data.verifie_le as string | undefined,
      verifiePar: data.verifie_par as string | undefined,
      commentaireVerification: data.commentaire_verification as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private static mapToJournal(data: Record<string, unknown>): JournalChantier {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      dateJournal: data.date_journal as string,
      meteo: data.meteo as JournalChantier['meteo'],
      effectifs: (data.effectifs as JournalChantier['effectifs']) || [],
      effectifTotal: (data.effectif_total as number) || 0,
      travauxRealises: (data.travaux_realises as JournalChantier['travauxRealises']) || [],
      observations: data.observations as string | undefined,
      incidents: data.incidents as string | undefined,
      visiteurs: (data.visiteurs as JournalChantier['visiteurs']) || [],
      photos: (data.photos as JournalChantier['photos']) || [],
      redigePar: data.redige_par as string | undefined,
      validePar: data.valide_par as string | undefined,
      valideLe: data.valide_le as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private static mapToChecklist(data: Record<string, unknown>): ChecklistDemarrage {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      items: (data.items as ChecklistItem[]) || [],
      itemsTotal: (data.items_total as number) || 0,
      itemsValides: (data.items_valides as number) || 0,
      pourcentageCompletion: (data.pourcentage_completion as number) || 0,
      estComplet: (data.est_complet as boolean) || false,
      peutDemarrer: (data.peut_demarrer as boolean) || false,
      validePar: data.valide_par as string | undefined,
      valideLe: data.valide_le as string | undefined,
      commentaires: data.commentaires as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}
