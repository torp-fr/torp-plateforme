/**
 * Service DOE/DIUO
 * Gestion du Dossier Ouvrages Exécutés et du Dossier d'Intervention Ultérieure
 * Carnet de santé du bâtiment et suivi de maintenance
 */

import { supabase } from '@/lib/supabase';
import {
  DOE,
  DocumentDOE,
  DocumentDOEType,
  CarnetSante,
  EntretienProgramme,
  EntretienRealise,
  DIUO,
  ZoneRisque,
  GarantieType,
} from '@/types/phase4.types';
import { emailService } from '@/services/email/email.service';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// DOCUMENTS OBLIGATOIRES DOE
// =====================================================

const DOCUMENTS_OBLIGATOIRES_DOE: {
  type: DocumentDOEType;
  categorie: string;
  nom: string;
  obligatoire: boolean;
}[] = [
  // Plans
  { type: 'plan_execution', categorie: 'Plans', nom: 'Plans d\'exécution conformes', obligatoire: true },
  { type: 'plan_execution', categorie: 'Plans', nom: 'Plans de récolement réseaux', obligatoire: true },
  { type: 'plan_execution', categorie: 'Plans', nom: 'Plans de structure', obligatoire: false },

  // Notices techniques
  { type: 'notice_technique', categorie: 'Notices', nom: 'Notice d\'utilisation chauffage', obligatoire: true },
  { type: 'notice_technique', categorie: 'Notices', nom: 'Notice VMC', obligatoire: true },
  { type: 'notice_technique', categorie: 'Notices', nom: 'Notice équipements électriques', obligatoire: true },
  { type: 'notice_technique', categorie: 'Notices', nom: 'Notice plomberie', obligatoire: false },

  // Fiches matériaux
  { type: 'fiche_materiau', categorie: 'Fiches matériaux', nom: 'Fiches techniques isolants', obligatoire: true },
  { type: 'fiche_materiau', categorie: 'Fiches matériaux', nom: 'Fiches techniques menuiseries', obligatoire: true },
  { type: 'fiche_materiau', categorie: 'Fiches matériaux', nom: 'Fiches techniques revêtements', obligatoire: false },

  // PV et contrôles
  { type: 'pv_controle', categorie: 'Contrôles', nom: 'Attestation CONSUEL', obligatoire: true },
  { type: 'pv_controle', categorie: 'Contrôles', nom: 'Certificat QUALIGAZ', obligatoire: true },
  { type: 'pv_controle', categorie: 'Contrôles', nom: 'Test étanchéité à l\'air', obligatoire: false },
  { type: 'pv_controle', categorie: 'Contrôles', nom: 'Attestation RT/RE', obligatoire: true },

  // Certificats
  { type: 'certificat', categorie: 'Certificats', nom: 'Certificat de conformité électrique', obligatoire: true },
  { type: 'certificat', categorie: 'Certificats', nom: 'Certificat de conformité gaz', obligatoire: true },

  // Garanties
  { type: 'garantie', categorie: 'Garanties', nom: 'Attestation décennale entreprise GE', obligatoire: true },
  { type: 'garantie', categorie: 'Garanties', nom: 'Attestation décennale autres lots', obligatoire: true },
  { type: 'garantie', categorie: 'Garanties', nom: 'Garanties constructeur équipements', obligatoire: true },
];

// =====================================================
// ENTRETIENS TYPE
// =====================================================

const ENTRETIENS_TYPES: Omit<EntretienProgramme, 'id' | 'derniereRealisation' | 'prochaineEcheance' | 'rappelEnvoye'>[] = [
  {
    equipement: 'Chaudière gaz',
    nature: 'Entretien annuel obligatoire',
    periodicite: 'annuel',
    periodiciteMois: 12,
    coutEstime: 150,
    obligatoire: true,
  },
  {
    equipement: 'Pompe à chaleur',
    nature: 'Contrôle étanchéité et performances',
    periodicite: 'annuel',
    periodiciteMois: 12,
    coutEstime: 200,
    obligatoire: true,
  },
  {
    equipement: 'VMC',
    nature: 'Nettoyage bouches et filtres',
    periodicite: 'annuel',
    periodiciteMois: 12,
    coutEstime: 80,
    obligatoire: false,
  },
  {
    equipement: 'Toiture',
    nature: 'Vérification étanchéité et évacuations',
    periodicite: 'annuel',
    periodiciteMois: 12,
    coutEstime: 150,
    obligatoire: false,
  },
  {
    equipement: 'Gouttières',
    nature: 'Nettoyage et vérification',
    periodicite: 'semestriel',
    periodiciteMois: 6,
    coutEstime: 100,
    obligatoire: false,
  },
  {
    equipement: 'Chauffe-eau thermodynamique',
    nature: 'Contrôle anode et détartrage',
    periodicite: '2 ans',
    periodiciteMois: 24,
    coutEstime: 120,
    obligatoire: false,
  },
  {
    equipement: 'Fosse septique',
    nature: 'Vidange',
    periodicite: '4 ans',
    periodiciteMois: 48,
    coutEstime: 350,
    obligatoire: true,
  },
  {
    equipement: 'Ramonage cheminée',
    nature: 'Ramonage obligatoire',
    periodicite: 'annuel',
    periodiciteMois: 12,
    coutEstime: 80,
    obligatoire: true,
  },
  {
    equipement: 'Détecteurs de fumée',
    nature: 'Test fonctionnement et pile',
    periodicite: 'annuel',
    periodiciteMois: 12,
    coutEstime: 0,
    obligatoire: true,
  },
];

// =====================================================
// SERVICE
// =====================================================

class DOEDIUOService {
  // =====================================================
  // DOE - DOSSIER OUVRAGES EXÉCUTÉS
  // =====================================================

  /**
   * Crée un nouveau DOE pour un chantier
   */
  async createDOE(chantierId: string): Promise<DOE> {
    const doeId = uuidv4();
    const now = new Date().toISOString();

    // Générer la liste des documents à collecter
    const documents: DocumentDOE[] = DOCUMENTS_OBLIGATOIRES_DOE.map(doc => ({
      id: uuidv4(),
      doeId,
      type: doc.type,
      categorie: doc.categorie,
      nom: doc.nom,
      fichierUrl: '',
      format: '',
      tailleMo: 0,
      obligatoire: doc.obligatoire,
      valide: false,
      uploadedAt: '',
      uploadedBy: '',
    }));

    const doe: DOE = {
      id: doeId,
      chantierId,
      statut: 'en_constitution',
      documents,
      plansExecution: documents.filter(d => d.type === 'plan_execution'),
      noticesTechniques: documents.filter(d => d.type === 'notice_technique'),
      fichesMateriaux: documents.filter(d => d.type === 'fiche_materiau'),
      pvControles: documents.filter(d => d.type === 'pv_controle'),
      certificats: documents.filter(d => d.type === 'certificat'),
      garanties: documents.filter(d => d.type === 'garantie'),
      pourcentageComplet: 0,
      documentsManquants: documents.filter(d => d.obligatoire).map(d => d.nom),
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase.from('doe').insert({
      id: doe.id,
      chantier_id: doe.chantierId,
      statut: doe.statut,
      documents: doe.documents,
      pourcentage_complet: doe.pourcentageComplet,
      documents_manquants: doe.documentsManquants,
      created_at: doe.createdAt,
      updated_at: doe.updatedAt,
    });

    if (error) {
      throw new Error('Impossible de créer le DOE');
    }

    return doe;
  }

  /**
   * Récupère un DOE
   */
  async getDOE(doeId: string): Promise<DOE | null> {
    const { data, error } = await supabase
      .from('doe')
      .select('*')
      .eq('id', doeId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDOE(data);
  }

  /**
   * Récupère le DOE d'un chantier
   */
  async getDOEByChantier(chantierId: string): Promise<DOE | null> {
    const { data, error } = await supabase
      .from('doe')
      .select('*')
      .eq('chantier_id', chantierId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDOE(data);
  }

  /**
   * Ajoute un document au DOE
   */
  async addDocument(
    doeId: string,
    document: {
      type: DocumentDOEType;
      categorie: string;
      nom: string;
      description?: string;
      reference?: string;
      fichierUrl: string;
      format: string;
      tailleMo: number;
      lot?: string;
      dateDocument?: string;
      dateExpiration?: string;
      uploadedBy: string;
    }
  ): Promise<DocumentDOE> {
    const doe = await this.getDOE(doeId);
    if (!doe) {
      throw new Error('DOE non trouvé');
    }

    // Chercher si un document du même nom existe déjà (pour mise à jour)
    const existingIndex = doe.documents.findIndex(
      d => d.nom.toLowerCase() === document.nom.toLowerCase()
    );

    const newDoc: DocumentDOE = {
      id: existingIndex >= 0 ? doe.documents[existingIndex].id : uuidv4(),
      doeId,
      type: document.type,
      categorie: document.categorie,
      nom: document.nom,
      description: document.description,
      reference: document.reference,
      fichierUrl: document.fichierUrl,
      format: document.format,
      tailleMo: document.tailleMo,
      lot: document.lot,
      dateDocument: document.dateDocument,
      dateExpiration: document.dateExpiration,
      obligatoire: existingIndex >= 0 ? doe.documents[existingIndex].obligatoire : false,
      valide: false,
      uploadedAt: new Date().toISOString(),
      uploadedBy: document.uploadedBy,
    };

    if (existingIndex >= 0) {
      doe.documents[existingIndex] = newDoc;
    } else {
      doe.documents.push(newDoc);
    }

    // Recalculer les statistiques
    this.updateDOEStats(doe);

    await supabase
      .from('doe')
      .update({
        documents: doe.documents,
        pourcentage_complet: doe.pourcentageComplet,
        documents_manquants: doe.documentsManquants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doeId);

    return newDoc;
  }

  /**
   * Valide un document
   */
  async validateDocument(
    doeId: string,
    documentId: string,
    validePar: string
  ): Promise<void> {
    const doe = await this.getDOE(doeId);
    if (!doe) {
      throw new Error('DOE non trouvé');
    }

    const doc = doe.documents.find(d => d.id === documentId);
    if (!doc) {
      throw new Error('Document non trouvé');
    }

    doc.valide = true;
    doc.dateValidation = new Date().toISOString();
    doc.validePar = validePar;

    this.updateDOEStats(doe);

    await supabase
      .from('doe')
      .update({
        documents: doe.documents,
        pourcentage_complet: doe.pourcentageComplet,
        documents_manquants: doe.documentsManquants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doeId);
  }

  /**
   * Marque le DOE comme complet
   */
  async markDOEComplete(doeId: string): Promise<DOE | null> {
    const doe = await this.getDOE(doeId);
    if (!doe) return null;

    // Vérifier que tous les documents obligatoires sont présents et validés
    const obligatoiresManquants = doe.documents.filter(
      d => d.obligatoire && (!d.fichierUrl || !d.valide)
    );

    if (obligatoiresManquants.length > 0) {
      throw new Error(
        `Documents obligatoires manquants ou non validés: ${obligatoiresManquants.map(d => d.nom).join(', ')}`
      );
    }

    const { data, error } = await supabase
      .from('doe')
      .update({
        statut: 'complet',
        updated_at: new Date().toISOString(),
      })
      .eq('id', doeId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDOE(data);
  }

  /**
   * Remet officiellement le DOE au maître d'ouvrage
   */
  async remettreDOE(doeId: string): Promise<DOE | null> {
    const doe = await this.getDOE(doeId);
    if (!doe) return null;

    if (doe.statut !== 'complet') {
      throw new Error('Le DOE doit être complet avant d\'être remis');
    }

    const { data, error } = await supabase
      .from('doe')
      .update({
        statut: 'remis',
        date_remise: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doeId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    // Notifier le maître d'ouvrage
    await this.notifyDOERemis(doeId);

    return this.mapDbToDOE(data);
  }

  /**
   * Valide définitivement le DOE
   */
  async validerDOE(doeId: string): Promise<DOE | null> {
    const { data, error } = await supabase
      .from('doe')
      .update({
        statut: 'valide',
        date_validation: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doeId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDOE(data);
  }

  // =====================================================
  // CARNET DE SANTÉ
  // =====================================================

  /**
   * Crée un carnet de santé pour le bâtiment
   */
  async createCarnetSante(
    chantierId: string,
    doeId: string,
    infos: {
      adresse: string;
      surface: number;
      anneeConstruction?: number;
      anneeRenovation?: number;
    }
  ): Promise<CarnetSante> {
    const carnetId = uuidv4();
    const now = new Date().toISOString();

    // Récupérer les garanties actives
    const { data: garantiesData } = await supabase
      .from('garanties')
      .select('*')
      .eq('chantier_id', chantierId)
      .eq('active', true);

    const garantiesActives = (garantiesData || []).map(g => ({
      type: g.type as GarantieType,
      dateDebut: g.date_debut,
      dateFin: g.date_fin,
      entreprise: g.entreprise_nom || '',
      assurance: g.assurance_nom,
    }));

    // Générer les entretiens programmés
    const entretiensProgrammes: EntretienProgramme[] = ENTRETIENS_TYPES.map(e => ({
      ...e,
      id: uuidv4(),
      prochaineEcheance: this.calculateProchaineEcheance(e.periodiciteMois),
      rappelEnvoye: false,
    }));

    const carnet: CarnetSante = {
      id: carnetId,
      chantierId,
      doeId,
      adresse: infos.adresse,
      surface: infos.surface,
      anneeConstruction: infos.anneeConstruction,
      anneeRenovation: infos.anneeRenovation,
      travaux: [],
      garantiesActives,
      entretiensProgrammes,
      entretiensRealises: [],
      contacts: [],
      travauxFutursRecommandes: [],
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase.from('carnets_sante').insert({
      id: carnet.id,
      chantier_id: carnet.chantierId,
      doe_id: carnet.doeId,
      adresse: carnet.adresse,
      surface: carnet.surface,
      annee_construction: carnet.anneeConstruction,
      annee_renovation: carnet.anneeRenovation,
      travaux: carnet.travaux,
      garanties_actives: carnet.garantiesActives,
      entretiens_programmes: carnet.entretiensProgrammes,
      entretiens_realises: carnet.entretiensRealises,
      contacts: carnet.contacts,
      travaux_futurs_recommandes: carnet.travauxFutursRecommandes,
      created_at: carnet.createdAt,
      updated_at: carnet.updatedAt,
    });

    if (error) {
      throw new Error('Impossible de créer le carnet de santé');
    }

    // Mettre à jour le DOE
    await supabase
      .from('doe')
      .update({
        carnet_sante_id: carnetId,
        updated_at: now,
      })
      .eq('id', doeId);

    return carnet;
  }

  /**
   * Récupère un carnet de santé
   */
  async getCarnetSante(carnetId: string): Promise<CarnetSante | null> {
    const { data, error } = await supabase
      .from('carnets_sante')
      .select('*')
      .eq('id', carnetId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToCarnetSante(data);
  }

  /**
   * Enregistre un entretien réalisé
   */
  async enregistrerEntretien(
    carnetId: string,
    entretien: {
      entretienProgrammeId?: string;
      equipement: string;
      nature: string;
      prestataire: string;
      cout?: number;
      observations?: string;
      factureUrl?: string;
      prochainEntretien?: string;
    }
  ): Promise<EntretienRealise> {
    const carnet = await this.getCarnetSante(carnetId);
    if (!carnet) {
      throw new Error('Carnet de santé non trouvé');
    }

    const newEntretien: EntretienRealise = {
      id: uuidv4(),
      ...entretien,
      date: new Date().toISOString(),
    };

    carnet.entretiensRealises.push(newEntretien);

    // Mettre à jour l'entretien programmé si lié
    if (entretien.entretienProgrammeId) {
      const programme = carnet.entretiensProgrammes.find(
        e => e.id === entretien.entretienProgrammeId
      );
      if (programme) {
        programme.derniereRealisation = new Date().toISOString();
        programme.prochaineEcheance = entretien.prochainEntretien ||
          this.calculateProchaineEcheance(programme.periodiciteMois);
        programme.rappelEnvoye = false;
      }
    }

    await supabase
      .from('carnets_sante')
      .update({
        entretiens_programmes: carnet.entretiensProgrammes,
        entretiens_realises: carnet.entretiensRealises,
        updated_at: new Date().toISOString(),
      })
      .eq('id', carnetId);

    return newEntretien;
  }

  /**
   * Ajoute une recommandation de travaux futurs
   */
  async addRecommandationTravaux(
    carnetId: string,
    recommandation: {
      nature: string;
      priorite: 'haute' | 'moyenne' | 'basse';
      echeance?: string;
      coutEstime?: number;
    }
  ): Promise<void> {
    const carnet = await this.getCarnetSante(carnetId);
    if (!carnet) {
      throw new Error('Carnet de santé non trouvé');
    }

    carnet.travauxFutursRecommandes.push(recommandation);

    await supabase
      .from('carnets_sante')
      .update({
        travaux_futurs_recommandes: carnet.travauxFutursRecommandes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', carnetId);
  }

  /**
   * Ajoute un contact au carnet
   */
  async addContact(
    carnetId: string,
    contact: {
      role: string;
      nom: string;
      telephone?: string;
      email?: string;
    }
  ): Promise<void> {
    const carnet = await this.getCarnetSante(carnetId);
    if (!carnet) {
      throw new Error('Carnet de santé non trouvé');
    }

    carnet.contacts.push(contact);

    await supabase
      .from('carnets_sante')
      .update({
        contacts: carnet.contacts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', carnetId);
  }

  /**
   * Envoie les rappels d'entretien
   */
  async sendRappelsEntretien(joursAvant: number = 30): Promise<number> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() + joursAvant);

    const { data: carnets, error } = await supabase
      .from('carnets_sante')
      .select('*, chantier:chantiers(*, user:users(*))');

    if (error || !carnets) return 0;

    let count = 0;

    for (const carnetData of carnets) {
      const carnet = this.mapDbToCarnetSante(carnetData);
      const user = carnetData.chantier?.user;

      if (!user?.email) continue;

      for (const entretien of carnet.entretiensProgrammes) {
        if (
          !entretien.rappelEnvoye &&
          new Date(entretien.prochaineEcheance) <= dateLimit
        ) {
          try {
            await emailService.sendTemplatedEmail(
              user.email,
              'rappel_entretien',
              {
                userName: user.full_name || 'Propriétaire',
                equipement: entretien.equipement,
                nature: entretien.nature,
                dateEcheance: new Date(entretien.prochaineEcheance).toLocaleDateString('fr-FR'),
                obligatoire: entretien.obligatoire,
                coutEstime: entretien.coutEstime,
              }
            );

            entretien.rappelEnvoye = true;
            count++;
          } catch (err) {
            console.error('[DOE] Erreur envoi rappel:', err);
          }
        }
      }

      // Mettre à jour les rappels envoyés
      await supabase
        .from('carnets_sante')
        .update({
          entretiens_programmes: carnet.entretiensProgrammes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', carnet.id);
    }

    return count;
  }

  // =====================================================
  // DIUO - DOSSIER INTERVENTION ULTÉRIEURE
  // =====================================================

  /**
   * Crée un nouveau DIUO
   */
  async createDIUO(
    chantierId: string,
    descriptif: {
      adresse: string;
      maitreOuvrage: string;
      anneeConstruction: number;
      surface: number;
      niveaux: number;
      acces: string;
    }
  ): Promise<DIUO> {
    const diuoId = uuidv4();
    const now = new Date().toISOString();

    const diuo: DIUO = {
      id: diuoId,
      chantierId,
      statut: 'en_constitution',
      descriptif,
      zones: [],
      mesuresGenerales: [
        'Port des EPI obligatoire sur le chantier',
        'Vérifier les habilitations avant intervention',
        'Consulter le DIUO avant toute intervention',
        'Signaler les incidents au maître d\'ouvrage',
      ],
      epiRecommandes: [
        'Casque de chantier',
        'Chaussures de sécurité',
        'Gants de protection',
        'Lunettes de protection',
        'Gilet haute visibilité',
      ],
      documents: [],
      plans: [],
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase.from('diuo').insert({
      id: diuo.id,
      chantier_id: diuo.chantierId,
      statut: diuo.statut,
      descriptif: diuo.descriptif,
      zones: diuo.zones,
      mesures_generales: diuo.mesuresGenerales,
      epi_recommandes: diuo.epiRecommandes,
      documents: diuo.documents,
      plans: diuo.plans,
      created_at: diuo.createdAt,
      updated_at: diuo.updatedAt,
    });

    if (error) {
      throw new Error('Impossible de créer le DIUO');
    }

    return diuo;
  }

  /**
   * Récupère un DIUO
   */
  async getDIUO(diuoId: string): Promise<DIUO | null> {
    const { data, error } = await supabase
      .from('diuo')
      .select('*')
      .eq('id', diuoId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDIUO(data);
  }

  /**
   * Récupère le DIUO d'un chantier
   */
  async getDIUOByChantier(chantierId: string): Promise<DIUO | null> {
    const { data, error } = await supabase
      .from('diuo')
      .select('*')
      .eq('chantier_id', chantierId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDIUO(data);
  }

  /**
   * Ajoute une zone à risque au DIUO
   */
  async addZoneRisque(
    diuoId: string,
    zone: Omit<ZoneRisque, 'id'>
  ): Promise<ZoneRisque> {
    const diuo = await this.getDIUO(diuoId);
    if (!diuo) {
      throw new Error('DIUO non trouvé');
    }

    const newZone: ZoneRisque = {
      ...zone,
      id: uuidv4(),
    };

    diuo.zones.push(newZone);

    await supabase
      .from('diuo')
      .update({
        zones: diuo.zones,
        updated_at: new Date().toISOString(),
      })
      .eq('id', diuoId);

    return newZone;
  }

  /**
   * Met à jour une zone à risque
   */
  async updateZoneRisque(
    diuoId: string,
    zoneId: string,
    updates: Partial<Omit<ZoneRisque, 'id'>>
  ): Promise<ZoneRisque | null> {
    const diuo = await this.getDIUO(diuoId);
    if (!diuo) return null;

    const zone = diuo.zones.find(z => z.id === zoneId);
    if (!zone) return null;

    Object.assign(zone, updates);

    await supabase
      .from('diuo')
      .update({
        zones: diuo.zones,
        updated_at: new Date().toISOString(),
      })
      .eq('id', diuoId);

    return zone;
  }

  /**
   * Ajoute un document au DIUO
   */
  async addDIUODocument(diuoId: string, documentUrl: string): Promise<void> {
    const diuo = await this.getDIUO(diuoId);
    if (!diuo) {
      throw new Error('DIUO non trouvé');
    }

    diuo.documents.push(documentUrl);

    await supabase
      .from('diuo')
      .update({
        documents: diuo.documents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', diuoId);
  }

  /**
   * Ajoute un plan au DIUO
   */
  async addDIUOPlan(diuoId: string, planUrl: string): Promise<void> {
    const diuo = await this.getDIUO(diuoId);
    if (!diuo) {
      throw new Error('DIUO non trouvé');
    }

    diuo.plans.push(planUrl);

    await supabase
      .from('diuo')
      .update({
        plans: diuo.plans,
        updated_at: new Date().toISOString(),
      })
      .eq('id', diuoId);
  }

  /**
   * Marque le DIUO comme complet
   */
  async markDIUOComplete(diuoId: string): Promise<DIUO | null> {
    const { data, error } = await supabase
      .from('diuo')
      .update({
        statut: 'complet',
        updated_at: new Date().toISOString(),
      })
      .eq('id', diuoId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDIUO(data);
  }

  /**
   * Remet officiellement le DIUO
   */
  async remettreDIUO(diuoId: string): Promise<DIUO | null> {
    const { data, error } = await supabase
      .from('diuo')
      .update({
        statut: 'remis',
        date_remise: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', diuoId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDIUO(data);
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private updateDOEStats(doe: DOE): void {
    const obligatoires = doe.documents.filter(d => d.obligatoire);
    const presentsValides = obligatoires.filter(d => d.fichierUrl && d.valide);

    doe.pourcentageComplet = obligatoires.length > 0
      ? Math.round((presentsValides.length / obligatoires.length) * 100)
      : 100;

    doe.documentsManquants = obligatoires
      .filter(d => !d.fichierUrl || !d.valide)
      .map(d => d.nom);

    // Mise à jour des sections
    doe.plansExecution = doe.documents.filter(d => d.type === 'plan_execution');
    doe.noticesTechniques = doe.documents.filter(d => d.type === 'notice_technique');
    doe.fichesMateriaux = doe.documents.filter(d => d.type === 'fiche_materiau');
    doe.pvControles = doe.documents.filter(d => d.type === 'pv_controle');
    doe.certificats = doe.documents.filter(d => d.type === 'certificat');
    doe.garanties = doe.documents.filter(d => d.type === 'garantie');
  }

  private calculateProchaineEcheance(mois: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() + mois);
    return date.toISOString();
  }

  private async notifyDOERemis(doeId: string): Promise<void> {
    const doe = await this.getDOE(doeId);
    if (!doe) return;

    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*, user:users(*)')
      .eq('id', doe.chantierId)
      .single();

    if (chantier?.user?.email) {
      await emailService.sendTemplatedEmail(
        chantier.user.email,
        'doe_remis',
        {
          userName: chantier.user.full_name || 'Maître d\'ouvrage',
          chantierReference: chantier.reference,
          nombreDocuments: doe.documents.length,
        }
      );
    }
  }

  private mapDbToDOE(data: Record<string, unknown>): DOE {
    const documents = (data.documents as DocumentDOE[]) || [];

    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      statut: data.statut as DOE['statut'],
      dateRemise: data.date_remise as string | undefined,
      dateValidation: data.date_validation as string | undefined,
      documents,
      plansExecution: documents.filter(d => d.type === 'plan_execution'),
      noticesTechniques: documents.filter(d => d.type === 'notice_technique'),
      fichesMateriaux: documents.filter(d => d.type === 'fiche_materiau'),
      pvControles: documents.filter(d => d.type === 'pv_controle'),
      certificats: documents.filter(d => d.type === 'certificat'),
      garanties: documents.filter(d => d.type === 'garantie'),
      pourcentageComplet: data.pourcentage_complet as number,
      documentsManquants: (data.documents_manquants as string[]) || [],
      carnetSante: undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private mapDbToCarnetSante(data: Record<string, unknown>): CarnetSante {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      doeId: data.doe_id as string,
      adresse: data.adresse as string,
      surface: data.surface as number,
      anneeConstruction: data.annee_construction as number | undefined,
      anneeRenovation: data.annee_renovation as number | undefined,
      travaux: (data.travaux as CarnetSante['travaux']) || [],
      garantiesActives: (data.garanties_actives as CarnetSante['garantiesActives']) || [],
      entretiensProgrammes: (data.entretiens_programmes as EntretienProgramme[]) || [],
      entretiensRealises: (data.entretiens_realises as EntretienRealise[]) || [],
      contacts: (data.contacts as CarnetSante['contacts']) || [],
      travauxFutursRecommandes: (data.travaux_futurs_recommandes as CarnetSante['travauxFutursRecommandes']) || [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private mapDbToDIUO(data: Record<string, unknown>): DIUO {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      statut: data.statut as DIUO['statut'],
      dateRemise: data.date_remise as string | undefined,
      descriptif: data.descriptif as DIUO['descriptif'],
      zones: (data.zones as ZoneRisque[]) || [],
      mesuresGenerales: (data.mesures_generales as string[]) || [],
      epiRecommandes: (data.epi_recommandes as string[]) || [],
      documents: (data.documents as string[]) || [],
      plans: (data.plans as string[]) || [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

export const doeDiuoService = new DOEDIUOService();
export default doeDiuoService;
