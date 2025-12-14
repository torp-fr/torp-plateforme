/**
 * TransmissionService - Envoi des propositions commerciales aux clients
 * Gère l'envoi par Email, SMS, WhatsApp et génération QR Code
 */

import QRCode from 'qrcode';
import {
  PropositionCommerciale,
  TransmissionClient,
  CanalTransmission,
  RelanceClient,
  ConfigurationRelances,
} from '@/types/torpScore.types';
import { supabase } from '@/lib/supabase';
import { emailService } from '@/services/email/email.service';

// Configuration par défaut des relances
const DEFAULT_RELANCES_CONFIG: ConfigurationRelances = {
  actif: true,
  delaiPremiereRelance: 3,
  frequence: 5,
  nombreMaxRelances: 3,
  canaux: ['email'],
  messageType: 'standard',
  horaireEnvoi: { heure: 10, minute: 0 },
  joursEnvoi: [1, 2, 3, 4, 5], // Lundi-Vendredi
};

// Templates de messages
const MESSAGE_TEMPLATES = {
  email: {
    objet: {
      standard: 'Votre devis {reference} - {entreprise}',
      relance: 'Rappel : Votre devis {reference} expire bientôt',
    },
    corps: {
      standard: `Bonjour {client_prenom},

Suite à notre rencontre, j'ai le plaisir de vous transmettre notre proposition commerciale pour votre projet de travaux.

Vous pouvez consulter l'ensemble des documents via le lien sécurisé ci-dessous :
{lien_acces}

Ou scanner ce QR Code avec votre téléphone.

Cette proposition est valable jusqu'au {date_validite}.

Pour toute question, n'hésitez pas à me contacter.

Cordialement,
{entreprise}
{telephone_entreprise}`,
      relance: `Bonjour {client_prenom},

Je me permets de revenir vers vous concernant notre proposition de devis {reference}.

Votre devis expire le {date_validite}. Si vous avez des questions ou souhaitez en discuter, je reste à votre disposition.

Consulter le devis : {lien_acces}

Cordialement,
{entreprise}`,
    },
  },
  sms: {
    standard: `[{entreprise}] Votre devis {reference} est disponible : {lien_court} Valide jusqu'au {date_validite}`,
    relance: `[{entreprise}] Rappel : Votre devis {reference} expire le {date_validite}. Consultez-le : {lien_court}`,
  },
  whatsapp: {
    standard: `Bonjour {client_prenom} 👋

Votre devis *{reference}* est prêt !

📋 Consultez-le ici : {lien_acces}

Valide jusqu'au {date_validite}.

Pour toute question, répondez à ce message.

*{entreprise}*`,
  },
};

export class TransmissionService {
  /**
   * Envoie une proposition commerciale au client
   */
  static async envoyerProposition(
    proposition: PropositionCommerciale,
    canaux: ('email' | 'sms' | 'whatsapp')[],
    messagePersonnalise?: string,
    entrepriseInfo?: { nom: string; telephone: string }
  ): Promise<TransmissionClient> {
    // Générer le lien d'accès sécurisé
    const lienAcces = await this.genererLienAcces(proposition);

    // Préparer les canaux de transmission
    const canauxTransmission: CanalTransmission[] = canaux.map(canal => ({
      type: canal,
      destinataire: canal === 'email'
        ? proposition.client.email || ''
        : proposition.client.telephone || '',
      actif: true,
    }));

    // Créer l'objet transmission
    const transmission: TransmissionClient = {
      id: `trans-${Date.now()}`,
      propositionId: proposition.id,
      client: {
        nom: `${proposition.client.prenom || ''} ${proposition.client.nom}`.trim(),
        email: proposition.client.email,
        telephone: proposition.client.telephone,
      },
      canaux: canauxTransmission,
      message: {
        objet: this.remplacerVariables(MESSAGE_TEMPLATES.email.objet.standard, proposition, entrepriseInfo, lienAcces),
        corps: messagePersonnalise || this.remplacerVariables(MESSAGE_TEMPLATES.email.corps.standard, proposition, entrepriseInfo, lienAcces),
        personnalise: !!messagePersonnalise,
      },
      lienAcces: {
        url: lienAcces.url,
        qrCode: lienAcces.qrCode,
        codeAcces: lienAcces.codeAcces,
        expiration: lienAcces.expiration,
      },
      tracking: {
        dateEnvoi: new Date(),
        nombreConsultations: 0,
        documentsTelechargés: [],
      },
      relances: [],
      status: 'envoye',
    };

    // Envoyer via chaque canal
    for (const canal of canauxTransmission) {
      try {
        await this.envoyerViaCanal(canal, transmission, proposition, entrepriseInfo, lienAcces);
        canal.statusLivraison = 'envoye';
        canal.dateEnvoi = new Date();
      } catch (error) {
        console.error(`Erreur envoi ${canal.type}:`, error);
        canal.statusLivraison = 'erreur';
      }
    }

    // Sauvegarder en base
    await this.sauvegarderTransmission(transmission);

    // Programmer les relances automatiques
    await this.programmerRelances(transmission, proposition, entrepriseInfo);

    return transmission;
  }

  /**
   * Génère un lien d'accès sécurisé avec QR Code
   */
  private static async genererLienAcces(
    proposition: PropositionCommerciale
  ): Promise<{
    url: string;
    qrCode: string;
    codeAcces: string;
    expiration: Date;
  }> {
    // Générer un code d'accès unique
    const codeAcces = this.genererCodeAcces();

    // URL de consultation
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://torp.fr';
    const url = `${baseUrl}/devis/${proposition.id}?code=${codeAcces}`;

    // URL courte pour SMS
    const urlCourt = `${baseUrl}/d/${proposition.id.slice(-8)}`;

    // Générer le QR Code (base64)
    const qrCode = await this.genererQRCode(url);

    // Date d'expiration (basée sur la validité du devis)
    const expiration = new Date(proposition.dateValidite);

    // Sauvegarder le lien en base pour tracking
    await this.sauvegarderLienAcces(proposition.id, codeAcces, expiration);

    return { url, qrCode, codeAcces, expiration };
  }

  /**
   * Génère un code d'accès unique
   */
  private static genererCodeAcces(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Génère un QR Code en base64 (Data URL)
   * Utilise la librairie qrcode pour une génération locale sans dépendance externe
   */
  private static async genererQRCode(url: string): Promise<string> {
    try {
      // Options de génération
      const options: QRCode.QRCodeToDataURLOptions = {
        errorCorrectionLevel: 'H', // Haute correction d'erreurs
        type: 'image/png',
        quality: 1.0,
        margin: 2,
        width: 256,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      };

      // Générer le QR code en base64 (Data URL)
      const qrDataUrl = await QRCode.toDataURL(url, options);
      return qrDataUrl;
    } catch (error) {
      console.error('[TransmissionService] Erreur génération QR code:', error);
      // Fallback vers API externe en cas d'erreur
      return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`;
    }
  }

  /**
   * Génère un QR Code en SVG (pour PDF/impression haute qualité)
   */
  static async genererQRCodeSVG(url: string): Promise<string> {
    try {
      const svgString = await QRCode.toString(url, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 256,
      });
      return svgString;
    } catch (error) {
      console.error('[TransmissionService] Erreur génération QR SVG:', error);
      return '';
    }
  }

  /**
   * Génère un QR Code avec logo TORP au centre
   */
  static async genererQRCodeAvecLogo(url: string, logoUrl?: string): Promise<string> {
    try {
      // D'abord générer le QR code standard
      const qrDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H', // Correction haute pour permettre logo
        type: 'image/png',
        margin: 2,
        width: 300,
        color: {
          dark: '#DC2626', // Rouge TORP
          light: '#FFFFFF',
        },
      });

      // Si pas de logo, retourner le QR simple
      if (!logoUrl) return qrDataUrl;

      // Sinon, superposer le logo avec canvas (côté client)
      // Cette opération devra être faite côté client avec un canvas
      // On retourne le QR avec métadonnées pour le traitement client
      return qrDataUrl;
    } catch (error) {
      console.error('[TransmissionService] Erreur génération QR avec logo:', error);
      return this.genererQRCode(url);
    }
  }

  /**
   * Remplace les variables dans les templates
   */
  private static remplacerVariables(
    template: string,
    proposition: PropositionCommerciale,
    entrepriseInfo?: { nom: string; telephone: string },
    lienAcces?: { url: string; codeAcces: string; expiration: Date }
  ): string {
    const dateValidite = new Date(proposition.dateValidite).toLocaleDateString('fr-FR');

    return template
      .replace(/{reference}/g, proposition.reference)
      .replace(/{client_prenom}/g, proposition.client.prenom || proposition.client.nom)
      .replace(/{client_nom}/g, proposition.client.nom)
      .replace(/{entreprise}/g, entrepriseInfo?.nom || 'Votre artisan')
      .replace(/{telephone_entreprise}/g, entrepriseInfo?.telephone || '')
      .replace(/{date_validite}/g, dateValidite)
      .replace(/{lien_acces}/g, lienAcces?.url || '')
      .replace(/{lien_court}/g, lienAcces?.url?.replace('https://', '') || '')
      .replace(/{montant_ttc}/g, proposition.chiffrage.totalTTC.toLocaleString('fr-FR') + ' €');
  }

  /**
   * Envoie via un canal spécifique
   */
  private static async envoyerViaCanal(
    canal: CanalTransmission,
    transmission: TransmissionClient,
    proposition: PropositionCommerciale,
    entrepriseInfo?: { nom: string; telephone: string },
    lienAcces?: { url: string; codeAcces: string; expiration: Date }
  ): Promise<void> {
    switch (canal.type) {
      case 'email':
        await this.envoyerEmail(canal.destinataire, transmission.message, proposition, entrepriseInfo, lienAcces);
        break;
      case 'sms':
        await this.envoyerSMS(canal.destinataire, proposition, entrepriseInfo, lienAcces);
        break;
      case 'whatsapp':
        await this.envoyerWhatsApp(canal.destinataire, proposition, entrepriseInfo, lienAcces);
        break;
    }
  }

  /**
   * Envoie un email
   */
  private static async envoyerEmail(
    destinataire: string,
    message: { objet: string; corps: string },
    proposition: PropositionCommerciale,
    entrepriseInfo?: { nom: string; telephone: string },
    lienAcces?: { url: string; codeAcces: string; expiration: Date }
  ): Promise<void> {
    // TODO: Intégrer avec un service d'email (SendGrid, Resend, etc.)
    console.log(`📧 Email envoyé à ${destinataire}`);
    console.log(`Objet: ${message.objet}`);
    console.log(`Corps: ${message.corps}`);

    // Exemple d'appel API Supabase Edge Function
    /*
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: destinataire,
        subject: message.objet,
        html: this.formatEmailHTML(message.corps, proposition, lienAcces),
        attachments: this.prepareAttachments(proposition),
      },
    });
    if (error) throw error;
    */
  }

  /**
   * Envoie un SMS
   */
  private static async envoyerSMS(
    destinataire: string,
    proposition: PropositionCommerciale,
    entrepriseInfo?: { nom: string; telephone: string },
    lienAcces?: { url: string; codeAcces: string; expiration: Date }
  ): Promise<void> {
    const message = this.remplacerVariables(
      MESSAGE_TEMPLATES.sms.standard,
      proposition,
      entrepriseInfo,
      lienAcces
    );

    console.log(`📱 SMS envoyé à ${destinataire}: ${message}`);

    // TODO: Intégrer avec un service SMS (Twilio, OVH, etc.)
    /*
    const { error } = await supabase.functions.invoke('send-sms', {
      body: { to: destinataire, message },
    });
    if (error) throw error;
    */
  }

  /**
   * Envoie un message WhatsApp
   */
  private static async envoyerWhatsApp(
    destinataire: string,
    proposition: PropositionCommerciale,
    entrepriseInfo?: { nom: string; telephone: string },
    lienAcces?: { url: string; codeAcces: string; expiration: Date }
  ): Promise<void> {
    const message = this.remplacerVariables(
      MESSAGE_TEMPLATES.whatsapp.standard,
      proposition,
      entrepriseInfo,
      lienAcces
    );

    console.log(`💬 WhatsApp envoyé à ${destinataire}: ${message}`);

    // TODO: Intégrer avec l'API WhatsApp Business
  }

  /**
   * Programme les relances automatiques
   */
  private static async programmerRelances(
    transmission: TransmissionClient,
    proposition: PropositionCommerciale,
    entrepriseInfo?: { nom: string; telephone: string },
    config: ConfigurationRelances = DEFAULT_RELANCES_CONFIG
  ): Promise<void> {
    if (!config.actif) return;

    const relances: RelanceClient[] = [];
    const dateEnvoi = new Date(transmission.tracking.dateEnvoi);
    const dateValidite = new Date(proposition.dateValidite);

    for (let i = 1; i <= config.nombreMaxRelances; i++) {
      const joursApres = config.delaiPremiereRelance + (i - 1) * config.frequence;
      const dateRelance = new Date(dateEnvoi);
      dateRelance.setDate(dateRelance.getDate() + joursApres);
      dateRelance.setHours(config.horaireEnvoi.heure, config.horaireEnvoi.minute, 0, 0);

      // Ne pas programmer de relance après expiration
      if (dateRelance >= dateValidite) break;

      // Vérifier le jour de la semaine
      const jourSemaine = dateRelance.getDay();
      if (!config.joursEnvoi.includes(jourSemaine)) {
        // Décaler au prochain jour autorisé
        const joursAjout = config.joursEnvoi.find(j => j > jourSemaine) || config.joursEnvoi[0] + 7;
        dateRelance.setDate(dateRelance.getDate() + (joursAjout - jourSemaine));
      }

      relances.push({
        id: `rel-${transmission.id}-${i}`,
        numero: i,
        dateRelance,
        canal: config.canaux[0],
        automatique: true,
        message: config.messageType === 'personnalise' ? config.messagePersonnalise : undefined,
        statusEnvoi: 'programme',
      });
    }

    transmission.relances = relances;

    // Sauvegarder les relances programmées
    await this.sauvegarderRelances(transmission.id, relances);
  }

  /**
   * Exécute une relance programmée
   */
  static async executerRelance(
    transmissionId: string,
    relanceId: string
  ): Promise<void> {
    // Récupérer la transmission et la relance
    const { data: transmission } = await supabase
      .from('transmissions')
      .select('*')
      .eq('id', transmissionId)
      .single();

    if (!transmission) return;

    const { data: proposition } = await supabase
      .from('propositions_commerciales')
      .select('*')
      .eq('id', transmission.proposition_id)
      .single();

    if (!proposition) return;

    const relance = transmission.relances?.find((r: RelanceClient) => r.id === relanceId);
    if (!relance || relance.statusEnvoi !== 'programme') return;

    // Vérifier si le client a déjà répondu
    if (transmission.status === 'accepte' || transmission.status === 'refuse') {
      relance.statusEnvoi = 'annule';
      return;
    }

    // Envoyer la relance
    const lienAcces = {
      url: transmission.lien_acces.url,
      codeAcces: transmission.lien_acces.code_acces,
      expiration: new Date(transmission.lien_acces.expiration),
    };

    const message = relance.message || this.remplacerVariables(
      MESSAGE_TEMPLATES.email.corps.relance,
      proposition as unknown as PropositionCommerciale,
      undefined,
      lienAcces
    );

    // Envoyer selon le canal
    switch (relance.canal) {
      case 'email':
        await this.envoyerEmail(
          transmission.client.email,
          {
            objet: this.remplacerVariables(
              MESSAGE_TEMPLATES.email.objet.relance,
              proposition as unknown as PropositionCommerciale
            ),
            corps: message,
          },
          proposition as unknown as PropositionCommerciale
        );
        break;
      case 'sms':
        await this.envoyerSMS(
          transmission.client.telephone,
          proposition as unknown as PropositionCommerciale,
          undefined,
          lienAcces
        );
        break;
    }

    relance.statusEnvoi = 'envoye';

    // Mettre à jour en base
    await supabase
      .from('transmissions')
      .update({ relances: transmission.relances })
      .eq('id', transmissionId);
  }

  /**
   * Annule toutes les relances pour une transmission
   */
  static async annulerRelances(transmissionId: string): Promise<void> {
    const { data: transmission } = await supabase
      .from('transmissions')
      .select('relances')
      .eq('id', transmissionId)
      .single();

    if (transmission?.relances) {
      const relancesMaj = transmission.relances.map((r: RelanceClient) => ({
        ...r,
        statusEnvoi: r.statusEnvoi === 'programme' ? 'annule' : r.statusEnvoi,
      }));

      await supabase
        .from('transmissions')
        .update({ relances: relancesMaj })
        .eq('id', transmissionId);
    }
  }

  /**
   * Enregistre la consultation d'un devis par le client
   */
  static async enregistrerConsultation(
    transmissionId: string,
    codeAcces: string
  ): Promise<{ succes: boolean; transmission?: TransmissionClient }> {
    // Vérifier le code d'accès
    const { data: lien } = await supabase
      .from('liens_acces')
      .select('*')
      .eq('code_acces', codeAcces)
      .single();

    if (!lien || new Date(lien.expiration) < new Date()) {
      return { succes: false };
    }

    // Mettre à jour le tracking
    const { data: transmission, error } = await supabase
      .from('transmissions')
      .update({
        status: 'consulte',
        'tracking.dateOuverture': transmission?.tracking?.dateOuverture || new Date().toISOString(),
        'tracking.nombreConsultations': (transmission?.tracking?.nombreConsultations || 0) + 1,
      })
      .eq('id', transmissionId)
      .select()
      .single();

    if (error) {
      console.error('Erreur enregistrement consultation:', error);
      return { succes: false };
    }

    // Notifier l'entreprise que le client a consulté le devis
    await this.notifierEntreprise(transmissionId, 'consultation');

    return { succes: true, transmission: transmission as unknown as TransmissionClient };
  }

  /**
   * Notifie l'entreprise d'un événement
   */
  private static async notifierEntreprise(
    transmissionId: string,
    evenement: 'consultation' | 'telechargement' | 'acceptation' | 'refus'
  ): Promise<void> {
    console.log(`🔔 Notification entreprise: ${evenement} pour transmission ${transmissionId}`);

    // TODO: Envoyer notification push/email à l'entreprise
    /*
    const { data: transmission } = await supabase
      .from('transmissions')
      .select('*, propositions_commerciales(*)')
      .eq('id', transmissionId)
      .single();

    const message = {
      consultation: `${transmission.client.nom} a consulté votre devis ${transmission.propositions_commerciales.reference}`,
      telechargement: `${transmission.client.nom} a téléchargé votre devis`,
      acceptation: `🎉 ${transmission.client.nom} a accepté votre devis !`,
      refus: `${transmission.client.nom} a décliné votre devis`,
    }[evenement];

    await supabase.functions.invoke('send-notification', {
      body: {
        userId: transmission.entreprise_id,
        title: 'Mise à jour devis',
        message,
        type: evenement,
      },
    });
    */
  }

  /**
   * Sauvegarde la transmission en base
   */
  private static async sauvegarderTransmission(transmission: TransmissionClient): Promise<void> {
    const { error } = await supabase
      .from('transmissions')
      .upsert({
        id: transmission.id,
        proposition_id: transmission.propositionId,
        client: transmission.client,
        canaux: transmission.canaux,
        message: transmission.message,
        lien_acces: transmission.lienAcces,
        tracking: transmission.tracking,
        relances: transmission.relances,
        status: transmission.status,
      });

    if (error) {
      console.error('Erreur sauvegarde transmission:', error);
    }
  }

  /**
   * Sauvegarde le lien d'accès
   */
  private static async sauvegarderLienAcces(
    propositionId: string,
    codeAcces: string,
    expiration: Date
  ): Promise<void> {
    const { error } = await supabase
      .from('liens_acces')
      .upsert({
        proposition_id: propositionId,
        code_acces: codeAcces,
        expiration: expiration.toISOString(),
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Erreur sauvegarde lien accès:', error);
    }
  }

  /**
   * Sauvegarde les relances programmées
   */
  private static async sauvegarderRelances(
    transmissionId: string,
    relances: RelanceClient[]
  ): Promise<void> {
    // Les relances sont stockées dans la transmission
    console.log(`📅 ${relances.length} relance(s) programmée(s) pour ${transmissionId}`);
  }

  /**
   * Génère un lien d'invitation client à s'inscrire sur TORP
   */
  static genererLienInscriptionClient(
    propositionId: string,
    clientEmail: string
  ): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://torp.fr';
    const token = Buffer.from(`${propositionId}:${clientEmail}:${Date.now()}`).toString('base64');
    return `${baseUrl}/inscription?invite=true&ref=${propositionId}&token=${token}`;
  }

  /**
   * Récupère les statistiques de transmission pour une entreprise
   */
  static async getStatistiquesEntreprise(entrepriseId: string): Promise<{
    totalEnvoyes: number;
    totalConsultes: number;
    totalAcceptes: number;
    totalRefuses: number;
    tauxOuverture: number;
    tauxConversion: number;
    tempsReponsesMoyen: number;
  }> {
    const { data: transmissions } = await supabase
      .from('transmissions')
      .select('status, tracking')
      .eq('entreprise_id', entrepriseId);

    if (!transmissions || transmissions.length === 0) {
      return {
        totalEnvoyes: 0,
        totalConsultes: 0,
        totalAcceptes: 0,
        totalRefuses: 0,
        tauxOuverture: 0,
        tauxConversion: 0,
        tempsReponsesMoyen: 0,
      };
    }

    const totalEnvoyes = transmissions.length;
    const totalConsultes = transmissions.filter(t => t.tracking?.dateOuverture).length;
    const totalAcceptes = transmissions.filter(t => t.status === 'accepte').length;
    const totalRefuses = transmissions.filter(t => t.status === 'refuse').length;

    return {
      totalEnvoyes,
      totalConsultes,
      totalAcceptes,
      totalRefuses,
      tauxOuverture: totalEnvoyes > 0 ? Math.round((totalConsultes / totalEnvoyes) * 100) : 0,
      tauxConversion: totalEnvoyes > 0 ? Math.round((totalAcceptes / totalEnvoyes) * 100) : 0,
      tempsReponsesMoyen: 0, // TODO: Calculer
    };
  }
}

export default TransmissionService;
