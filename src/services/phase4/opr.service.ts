/**
 * Service OPR - Opérations Préalables à la Réception
 * Gestion des sessions OPR, contrôles, documents et réserves initiales
 */

import { supabase } from '@/lib/supabase';
import {
  OPRSession,
  OPRParticipant,
  OPRControle,
  DocumentVerification,
  Reserve,
  ReserveGravite,
  CheckListOPR,
  ParticipantRole,
} from '@/types/phase4.types';
import { emailService } from '@/services/email/email.service';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// CHECK-LISTS PAR DÉFAUT
// =====================================================

const DEFAULT_CHECKLISTS: CheckListOPR[] = [
  {
    id: 'checklist-gros-oeuvre',
    nom: 'Contrôle Gros Œuvre',
    description: 'Points de contrôle pour le lot gros œuvre',
    lots: ['gros_oeuvre', 'maconnerie', 'structure'],
    categories: [
      {
        nom: 'Structure',
        lot: 'gros_oeuvre',
        points: [
          { id: 'go-01', libelle: 'Planéité des murs', obligatoire: true, normeReference: 'DTU 20.1' },
          { id: 'go-02', libelle: 'Verticalité des parois', obligatoire: true, normeReference: 'DTU 20.1' },
          { id: 'go-03', libelle: 'Dimensions conformes aux plans', obligatoire: true },
          { id: 'go-04', libelle: 'Pas de fissures structurelles', obligatoire: true },
          { id: 'go-05', libelle: 'Joints de dilatation conformes', obligatoire: false },
        ],
      },
      {
        nom: 'Finitions',
        lot: 'gros_oeuvre',
        points: [
          { id: 'go-06', libelle: 'Ragréage correct', obligatoire: false },
          { id: 'go-07', libelle: 'Pas d\'éclatement de béton', obligatoire: true },
          { id: 'go-08', libelle: 'Réservations conformes', obligatoire: true },
        ],
      },
    ],
    nombrePointsTotal: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'checklist-plomberie',
    nom: 'Contrôle Plomberie',
    description: 'Points de contrôle pour les installations sanitaires',
    lots: ['plomberie', 'sanitaire'],
    categories: [
      {
        nom: 'Alimentation eau',
        lot: 'plomberie',
        points: [
          { id: 'pl-01', libelle: 'Test pression réseau (10 bars)', obligatoire: true, normeReference: 'DTU 60.1' },
          { id: 'pl-02', libelle: 'Pas de fuites visibles', obligatoire: true },
          { id: 'pl-03', libelle: 'Calorifugeage conforme', obligatoire: false },
          { id: 'pl-04', libelle: 'Vannes d\'arrêt accessibles', obligatoire: true },
          { id: 'pl-05', libelle: 'Débit eau chaude correct', obligatoire: true },
        ],
      },
      {
        nom: 'Évacuations',
        lot: 'plomberie',
        points: [
          { id: 'pl-06', libelle: 'Test écoulement', obligatoire: true },
          { id: 'pl-07', libelle: 'Pentes conformes', obligatoire: true, normeReference: 'DTU 60.11' },
          { id: 'pl-08', libelle: 'Siphons présents', obligatoire: true },
          { id: 'pl-09', libelle: 'Ventilations primaires', obligatoire: true },
        ],
      },
      {
        nom: 'Appareils sanitaires',
        lot: 'sanitaire',
        points: [
          { id: 'pl-10', libelle: 'Fixations solides', obligatoire: true },
          { id: 'pl-11', libelle: 'Joints silicone propres', obligatoire: false },
          { id: 'pl-12', libelle: 'Robinetterie fonctionnelle', obligatoire: true },
        ],
      },
    ],
    nombrePointsTotal: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'checklist-electricite',
    nom: 'Contrôle Électricité',
    description: 'Points de contrôle pour les installations électriques',
    lots: ['electricite', 'courants_faibles'],
    categories: [
      {
        nom: 'Tableau électrique',
        lot: 'electricite',
        points: [
          { id: 'el-01', libelle: 'Attestation CONSUEL', obligatoire: true },
          { id: 'el-02', libelle: 'Disjoncteur différentiel 30mA', obligatoire: true, normeReference: 'NF C 15-100' },
          { id: 'el-03', libelle: 'Repérage des circuits', obligatoire: true },
          { id: 'el-04', libelle: 'Dimensionnement correct', obligatoire: true },
        ],
      },
      {
        nom: 'Circuits',
        lot: 'electricite',
        points: [
          { id: 'el-05', libelle: 'Test continuité terre', obligatoire: true },
          { id: 'el-06', libelle: 'Prises conformes (2P+T)', obligatoire: true },
          { id: 'el-07', libelle: 'Interrupteurs fonctionnels', obligatoire: true },
          { id: 'el-08', libelle: 'Luminaires installés', obligatoire: false },
        ],
      },
      {
        nom: 'Courants faibles',
        lot: 'courants_faibles',
        points: [
          { id: 'el-09', libelle: 'Baie de brassage', obligatoire: false },
          { id: 'el-10', libelle: 'Prises RJ45 fonctionnelles', obligatoire: false },
          { id: 'el-11', libelle: 'Prise TV', obligatoire: false },
        ],
      },
    ],
    nombrePointsTotal: 11,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'checklist-menuiseries',
    nom: 'Contrôle Menuiseries',
    description: 'Points de contrôle pour les menuiseries intérieures et extérieures',
    lots: ['menuiseries_ext', 'menuiseries_int'],
    categories: [
      {
        nom: 'Menuiseries extérieures',
        lot: 'menuiseries_ext',
        points: [
          { id: 'me-01', libelle: 'Étanchéité fenêtres (test eau)', obligatoire: true, normeReference: 'DTU 36.5' },
          { id: 'me-02', libelle: 'Fonctionnement ouvertures', obligatoire: true },
          { id: 'me-03', libelle: 'Vitrage conforme', obligatoire: true },
          { id: 'me-04', libelle: 'Quincaillerie fonctionnelle', obligatoire: true },
          { id: 'me-05', libelle: 'Volets roulants', obligatoire: false },
          { id: 'me-06', libelle: 'Seuils et rejingots', obligatoire: true },
        ],
      },
      {
        nom: 'Menuiseries intérieures',
        lot: 'menuiseries_int',
        points: [
          { id: 'mi-01', libelle: 'Portes : aplomb et équerrage', obligatoire: true },
          { id: 'mi-02', libelle: 'Fermetures fluides', obligatoire: true },
          { id: 'mi-03', libelle: 'Serrures fonctionnelles', obligatoire: true },
          { id: 'mi-04', libelle: 'Plinthes posées', obligatoire: false },
        ],
      },
    ],
    nombrePointsTotal: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'checklist-chauffage',
    nom: 'Contrôle Chauffage/Climatisation',
    description: 'Points de contrôle pour les systèmes de chauffage et climatisation',
    lots: ['chauffage', 'climatisation', 'ventilation'],
    categories: [
      {
        nom: 'Chauffage',
        lot: 'chauffage',
        points: [
          { id: 'ch-01', libelle: 'Mise en service chaudière', obligatoire: true },
          { id: 'ch-02', libelle: 'Attestation QUALIGAZ', obligatoire: true },
          { id: 'ch-03', libelle: 'Radiateurs : purge et équilibrage', obligatoire: true },
          { id: 'ch-04', libelle: 'Thermostat fonctionnel', obligatoire: true },
          { id: 'ch-05', libelle: 'Test montée en température', obligatoire: false },
        ],
      },
      {
        nom: 'VMC',
        lot: 'ventilation',
        points: [
          { id: 'ch-06', libelle: 'VMC fonctionnelle', obligatoire: true },
          { id: 'ch-07', libelle: 'Bouches extraction', obligatoire: true },
          { id: 'ch-08', libelle: 'Entrées d\'air conformes', obligatoire: true },
        ],
      },
    ],
    nombrePointsTotal: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Documents obligatoires à vérifier
const DOCUMENTS_OBLIGATOIRES: Omit<DocumentVerification, 'id' | 'present' | 'conforme' | 'commentaire' | 'fichier'>[] = [
  { type: 'consuel', nom: 'Attestation CONSUEL', obligatoire: true },
  { type: 'qualigaz', nom: 'Certificat QUALIGAZ', obligatoire: true },
  { type: 'attestation_rt', nom: 'Attestation RT 2012/RE 2020', obligatoire: true },
  { type: 'test_etancheite', nom: 'Test d\'étanchéité à l\'air', obligatoire: false },
  { type: 'notice', nom: 'Notices d\'utilisation équipements', obligatoire: true },
  { type: 'garantie', nom: 'Attestations de garantie constructeur', obligatoire: true },
];

// =====================================================
// SERVICE
// =====================================================

class OPRService {
  // =====================================================
  // GESTION DES SESSIONS OPR
  // =====================================================

  /**
   * Crée une nouvelle session OPR
   */
  async createSession(
    chantierId: string,
    params: {
      dateOPR: string;
      heureDebut: string;
      lieu: string;
      lots: string[];
      createdBy: string;
    }
  ): Promise<OPRSession> {
    const sessionId = uuidv4();

    // Générer les contrôles à partir des checklists
    const controles = this.generateControlesFromChecklists(params.lots);

    // Générer la liste des documents à vérifier
    const documentsVerifies = this.generateDocumentVerifications();

    const session: OPRSession = {
      id: sessionId,
      chantierId,
      dateOPR: params.dateOPR,
      heureDebut: params.heureDebut,
      lieu: params.lieu,
      statut: 'planifiee',
      participants: [],
      convocationEnvoyee: false,
      modeConvocation: [],
      controles,
      reserves: [],
      documentsVerifies,
      photosGenerales: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: params.createdBy,
    };

    // Sauvegarder en base
    const { error } = await supabase.from('opr_sessions').insert({
      id: session.id,
      chantier_id: session.chantierId,
      date_opr: session.dateOPR,
      heure_debut: session.heureDebut,
      lieu: session.lieu,
      statut: session.statut,
      participants: session.participants,
      convocation_envoyee: session.convocationEnvoyee,
      mode_convocation: session.modeConvocation,
      controles: session.controles,
      reserves: session.reserves,
      documents_verifies: session.documentsVerifies,
      photos_generales: session.photosGenerales,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      created_by: session.createdBy,
    });

    if (error) {
      console.error('[OPR] Erreur création session:', error);
      throw new Error('Impossible de créer la session OPR');
    }

    return session;
  }

  /**
   * Récupère une session OPR
   */
  async getSession(sessionId: string): Promise<OPRSession | null> {
    const { data, error } = await supabase
      .from('opr_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToSession(data);
  }

  /**
   * Liste les sessions OPR d'un chantier
   */
  async getSessionsByChantier(chantierId: string): Promise<OPRSession[]> {
    const { data, error } = await supabase
      .from('opr_sessions')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('date_opr', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToSession);
  }

  /**
   * Met à jour une session OPR
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<OPRSession, 'dateOPR' | 'heureDebut' | 'heureFin' | 'lieu' | 'statut'>>
  ): Promise<OPRSession | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.dateOPR) updateData.date_opr = updates.dateOPR;
    if (updates.heureDebut) updateData.heure_debut = updates.heureDebut;
    if (updates.heureFin) updateData.heure_fin = updates.heureFin;
    if (updates.lieu) updateData.lieu = updates.lieu;
    if (updates.statut) updateData.statut = updates.statut;

    const { data, error } = await supabase
      .from('opr_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToSession(data);
  }

  /**
   * Démarre une session OPR
   */
  async startSession(sessionId: string): Promise<OPRSession | null> {
    return this.updateSession(sessionId, {
      statut: 'en_cours',
      heureDebut: new Date().toTimeString().slice(0, 5),
    });
  }

  /**
   * Termine une session OPR
   */
  async endSession(sessionId: string): Promise<OPRSession | null> {
    return this.updateSession(sessionId, {
      statut: 'terminee',
      heureFin: new Date().toTimeString().slice(0, 5),
    });
  }

  // =====================================================
  // GESTION DES PARTICIPANTS
  // =====================================================

  /**
   * Ajoute un participant à la session
   */
  async addParticipant(
    sessionId: string,
    participant: Omit<OPRParticipant, 'id' | 'present' | 'signature' | 'dateSignature'>
  ): Promise<OPRParticipant> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const newParticipant: OPRParticipant = {
      ...participant,
      id: uuidv4(),
      present: false,
    };

    session.participants.push(newParticipant);

    await supabase
      .from('opr_sessions')
      .update({
        participants: session.participants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return newParticipant;
  }

  /**
   * Marque un participant comme présent
   */
  async markParticipantPresent(
    sessionId: string,
    participantId: string,
    present: boolean = true
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      throw new Error('Participant non trouvé');
    }

    participant.present = present;

    await supabase
      .from('opr_sessions')
      .update({
        participants: session.participants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  /**
   * Enregistre la signature d'un participant
   */
  async signParticipant(
    sessionId: string,
    participantId: string,
    signatureBase64: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      throw new Error('Participant non trouvé');
    }

    participant.signature = signatureBase64;
    participant.dateSignature = new Date().toISOString();
    participant.present = true;

    await supabase
      .from('opr_sessions')
      .update({
        participants: session.participants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  // =====================================================
  // CONVOCATIONS
  // =====================================================

  /**
   * Envoie les convocations aux participants
   */
  async sendConvocations(
    sessionId: string,
    mode: ('email' | 'lrar' | 'courrier')[]
  ): Promise<{ success: boolean; errors: string[] }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const errors: string[] = [];

    // Récupérer les infos du chantier
    const { data: chantier } = await supabase
      .from('chantiers')
      .select('reference, adresse, nom')
      .eq('id', session.chantierId)
      .single();

    for (const participant of session.participants) {
      if (mode.includes('email') && participant.email) {
        try {
          await emailService.sendTemplatedEmail(
            participant.email,
            'opr_convocation',
            {
              participantNom: `${participant.prenom} ${participant.nom}`,
              dateOPR: new Date(session.dateOPR).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              heureOPR: session.heureDebut,
              lieuOPR: session.lieu,
              chantierReference: chantier?.reference || session.chantierId,
              chantierAdresse: chantier?.adresse || session.lieu,
              role: this.translateRole(participant.role),
            }
          );
        } catch (error) {
          errors.push(`Email non envoyé à ${participant.email}: ${error}`);
        }
      }
    }

    // Mettre à jour la session
    await supabase
      .from('opr_sessions')
      .update({
        convocation_envoyee: true,
        date_convocation: new Date().toISOString(),
        mode_convocation: mode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return {
      success: errors.length === 0,
      errors,
    };
  }

  // =====================================================
  // CONTRÔLES
  // =====================================================

  /**
   * Met à jour le statut d'un contrôle
   */
  async updateControle(
    sessionId: string,
    controleId: string,
    update: {
      statut: OPRControle['statut'];
      commentaire?: string;
      photos?: string[];
    }
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const controle = session.controles.find(c => c.id === controleId);
    if (!controle) {
      throw new Error('Contrôle non trouvé');
    }

    controle.statut = update.statut;
    if (update.commentaire) controle.commentaire = update.commentaire;
    if (update.photos) controle.photos = update.photos;

    await supabase
      .from('opr_sessions')
      .update({
        controles: session.controles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  /**
   * Crée une réserve à partir d'un contrôle non conforme
   */
  async createReserveFromControle(
    sessionId: string,
    controleId: string,
    reserveData: {
      nature: string;
      description: string;
      gravite: ReserveGravite;
      localisation: string;
      piece?: string;
      entrepriseId: string;
      entrepriseNom: string;
      photos?: string[];
      coutEstime?: number;
    }
  ): Promise<Reserve> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const controle = session.controles.find(c => c.id === controleId);
    if (!controle) {
      throw new Error('Contrôle non trouvé');
    }

    // Calculer le délai selon la gravité
    const delaiJours = this.calculateDelaiLevee(reserveData.gravite);
    const dateEcheance = new Date();
    dateEcheance.setDate(dateEcheance.getDate() + delaiJours);

    const reserve: Reserve = {
      id: uuidv4(),
      oprId: sessionId,
      chantierId: session.chantierId,
      numero: session.reserves.length + 1,
      lot: controle.lot,
      piece: reserveData.piece,
      localisation: reserveData.localisation,
      nature: reserveData.nature,
      description: reserveData.description,
      gravite: reserveData.gravite,
      photos: (reserveData.photos || []).map((url, i) => ({
        id: `photo-${i}`,
        url,
        dateCapture: new Date().toISOString(),
        type: 'avant' as const,
      })),
      statut: 'ouverte',
      entrepriseId: reserveData.entrepriseId,
      entrepriseNom: reserveData.entrepriseNom,
      delaiLeveeJours: delaiJours,
      dateEcheance: dateEcheance.toISOString(),
      contestee: false,
      coutEstime: reserveData.coutEstime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Lier la réserve au contrôle
    controle.statut = 'reserve';
    controle.reserveId = reserve.id;

    // Ajouter la réserve
    session.reserves.push(reserve);

    await supabase
      .from('opr_sessions')
      .update({
        controles: session.controles,
        reserves: session.reserves,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return reserve;
  }

  /**
   * Ajoute une réserve libre (non liée à un contrôle)
   */
  async addReserve(
    sessionId: string,
    reserveData: {
      lot: string;
      piece?: string;
      localisation: string;
      nature: string;
      description: string;
      gravite: ReserveGravite;
      entrepriseId: string;
      entrepriseNom: string;
      photos?: string[];
      coutEstime?: number;
    }
  ): Promise<Reserve> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const delaiJours = this.calculateDelaiLevee(reserveData.gravite);
    const dateEcheance = new Date();
    dateEcheance.setDate(dateEcheance.getDate() + delaiJours);

    const reserve: Reserve = {
      id: uuidv4(),
      oprId: sessionId,
      chantierId: session.chantierId,
      numero: session.reserves.length + 1,
      lot: reserveData.lot,
      piece: reserveData.piece,
      localisation: reserveData.localisation,
      nature: reserveData.nature,
      description: reserveData.description,
      gravite: reserveData.gravite,
      photos: (reserveData.photos || []).map((url, i) => ({
        id: `photo-${i}`,
        url,
        dateCapture: new Date().toISOString(),
        type: 'avant' as const,
      })),
      statut: 'ouverte',
      entrepriseId: reserveData.entrepriseId,
      entrepriseNom: reserveData.entrepriseNom,
      delaiLeveeJours: delaiJours,
      dateEcheance: dateEcheance.toISOString(),
      contestee: false,
      coutEstime: reserveData.coutEstime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    session.reserves.push(reserve);

    await supabase
      .from('opr_sessions')
      .update({
        reserves: session.reserves,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return reserve;
  }

  // =====================================================
  // DOCUMENTS
  // =====================================================

  /**
   * Met à jour le statut d'un document
   */
  async updateDocument(
    sessionId: string,
    documentId: string,
    update: {
      present: boolean;
      conforme?: boolean;
      commentaire?: string;
      fichier?: string;
    }
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    const document = session.documentsVerifies.find(d => d.id === documentId);
    if (!document) {
      throw new Error('Document non trouvé');
    }

    document.present = update.present;
    if (update.conforme !== undefined) document.conforme = update.conforme;
    if (update.commentaire) document.commentaire = update.commentaire;
    if (update.fichier) document.fichier = update.fichier;

    await supabase
      .from('opr_sessions')
      .update({
        documents_verifies: session.documentsVerifies,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  // =====================================================
  // PHOTOS
  // =====================================================

  /**
   * Ajoute une photo générale à la session
   */
  async addPhoto(sessionId: string, photoUrl: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session OPR non trouvée');
    }

    session.photosGenerales.push(photoUrl);

    await supabase
      .from('opr_sessions')
      .update({
        photos_generales: session.photosGenerales,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  // =====================================================
  // STATISTIQUES
  // =====================================================

  /**
   * Calcule les statistiques d'avancement d'une session
   */
  getSessionStats(session: OPRSession): {
    totalControles: number;
    controlesVerifies: number;
    controlesConformes: number;
    controlesNonConformes: number;
    controlesReserves: number;
    pourcentageAvancement: number;
    totalReserves: number;
    reservesMineures: number;
    reservesMajeures: number;
    reservesGraves: number;
    documentsPresents: number;
    documentsManquants: number;
  } {
    const controlesVerifies = session.controles.filter(
      c => c.statut !== 'non_verifie'
    );
    const controlesConformes = session.controles.filter(
      c => c.statut === 'conforme'
    );
    const controlesNonConformes = session.controles.filter(
      c => c.statut === 'non_conforme'
    );
    const controlesReserves = session.controles.filter(
      c => c.statut === 'reserve'
    );

    const documentsPresents = session.documentsVerifies.filter(d => d.present);
    const documentsManquants = session.documentsVerifies.filter(
      d => d.obligatoire && !d.present
    );

    return {
      totalControles: session.controles.length,
      controlesVerifies: controlesVerifies.length,
      controlesConformes: controlesConformes.length,
      controlesNonConformes: controlesNonConformes.length,
      controlesReserves: controlesReserves.length,
      pourcentageAvancement: Math.round(
        (controlesVerifies.length / session.controles.length) * 100
      ),
      totalReserves: session.reserves.length,
      reservesMineures: session.reserves.filter(r => r.gravite === 'mineure').length,
      reservesMajeures: session.reserves.filter(r => r.gravite === 'majeure').length,
      reservesGraves: session.reserves.filter(
        r => r.gravite === 'grave' || r.gravite === 'non_conformite_substantielle'
      ).length,
      documentsPresents: documentsPresents.length,
      documentsManquants: documentsManquants.length,
    };
  }

  /**
   * Détermine si la session permet une réception
   */
  canProceedToReception(session: OPRSession): {
    canProceed: boolean;
    blockers: string[];
    warnings: string[];
  } {
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Vérifier les contrôles obligatoires
    const controlesObligatoiresNonVerifies = session.controles.filter(
      c => c.obligatoire && c.statut === 'non_verifie'
    );
    if (controlesObligatoiresNonVerifies.length > 0) {
      blockers.push(
        `${controlesObligatoiresNonVerifies.length} contrôle(s) obligatoire(s) non vérifié(s)`
      );
    }

    // Vérifier les documents obligatoires
    const docsManquants = session.documentsVerifies.filter(
      d => d.obligatoire && !d.present
    );
    if (docsManquants.length > 0) {
      blockers.push(
        `Documents manquants: ${docsManquants.map(d => d.nom).join(', ')}`
      );
    }

    // Vérifier les réserves graves
    const reservesGraves = session.reserves.filter(
      r => r.gravite === 'non_conformite_substantielle'
    );
    if (reservesGraves.length > 0) {
      blockers.push(
        `${reservesGraves.length} non-conformité(s) substantielle(s) bloquante(s)`
      );
    }

    // Warnings
    const reservesMajeures = session.reserves.filter(
      r => r.gravite === 'majeure' || r.gravite === 'grave'
    );
    if (reservesMajeures.length > 0) {
      warnings.push(
        `${reservesMajeures.length} réserve(s) majeure(s) ou grave(s)`
      );
    }

    // Participants non signés
    const nonSignes = session.participants.filter(
      p => p.present && !p.signature
    );
    if (nonSignes.length > 0) {
      warnings.push(
        `${nonSignes.length} participant(s) présent(s) sans signature`
      );
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  // =====================================================
  // CHECK-LISTS
  // =====================================================

  /**
   * Récupère les check-lists disponibles
   */
  getAvailableChecklists(): CheckListOPR[] {
    return DEFAULT_CHECKLISTS;
  }

  /**
   * Récupère une check-list par lot
   */
  getChecklistForLot(lot: string): CheckListOPR | undefined {
    return DEFAULT_CHECKLISTS.find(c => c.lots.includes(lot));
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private generateControlesFromChecklists(lots: string[]): OPRControle[] {
    const controles: OPRControle[] = [];

    for (const lot of lots) {
      const checklist = this.getChecklistForLot(lot);
      if (checklist) {
        for (const categorie of checklist.categories) {
          for (const point of categorie.points) {
            controles.push({
              id: uuidv4(),
              lot: categorie.lot,
              categorie: categorie.nom,
              point: point.libelle,
              description: point.description || '',
              obligatoire: point.obligatoire,
              statut: 'non_verifie',
            });
          }
        }
      }
    }

    return controles;
  }

  private generateDocumentVerifications(): DocumentVerification[] {
    return DOCUMENTS_OBLIGATOIRES.map(doc => ({
      ...doc,
      id: uuidv4(),
      present: false,
      conforme: false,
    }));
  }

  private calculateDelaiLevee(gravite: ReserveGravite): number {
    switch (gravite) {
      case 'mineure':
        return 30; // 30 jours
      case 'majeure':
        return 60; // 60 jours
      case 'grave':
        return 90; // 90 jours
      case 'non_conformite_substantielle':
        return 0; // Bloquant - pas de délai
      default:
        return 30;
    }
  }

  private translateRole(role: ParticipantRole): string {
    const translations: Record<ParticipantRole, string> = {
      maitre_ouvrage: 'Maître d\'ouvrage',
      maitre_oeuvre: 'Maître d\'œuvre',
      entreprise: 'Entreprise',
      bureau_controle: 'Bureau de contrôle',
      coordonnateur_sps: 'Coordonnateur SPS',
      expert: 'Expert',
      assureur: 'Assureur',
    };
    return translations[role] || role;
  }

  private mapDbToSession(data: Record<string, unknown>): OPRSession {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      dateOPR: data.date_opr as string,
      heureDebut: data.heure_debut as string,
      heureFin: data.heure_fin as string | undefined,
      lieu: data.lieu as string,
      statut: data.statut as OPRSession['statut'],
      participants: (data.participants as OPRParticipant[]) || [],
      convocationEnvoyee: data.convocation_envoyee as boolean,
      dateConvocation: data.date_convocation as string | undefined,
      modeConvocation: (data.mode_convocation as OPRSession['modeConvocation']) || [],
      controles: (data.controles as OPRControle[]) || [],
      reserves: (data.reserves as Reserve[]) || [],
      documentsVerifies: (data.documents_verifies as DocumentVerification[]) || [],
      photosGenerales: (data.photos_generales as string[]) || [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      createdBy: data.created_by as string,
    };
  }
}

export const oprService = new OPRService();
export default oprService;
