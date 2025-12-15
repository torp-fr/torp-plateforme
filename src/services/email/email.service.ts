/**
 * Email Service
 * Service d'envoi d'emails transactionnels via Resend
 * Support SMS via Twilio
 */

import { Resend } from 'resend';

const resend = import.meta.env.VITE_RESEND_API_KEY
  ? new Resend(import.meta.env.VITE_RESEND_API_KEY)
  : null;

const EMAIL_FROM = import.meta.env.VITE_EMAIL_FROM || 'TORP <noreply@torp.fr>';
const APP_URL = import.meta.env.VITE_APP_URL || 'https://torp.fr';

// Twilio configuration for SMS
const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  /**
   * Vérifie si le service email est configuré
   */
  isConfigured(): boolean {
    return !!resend;
  }

  /**
   * Envoie un email générique
   */
  async send(template: EmailTemplate): Promise<{ success: boolean; error?: string }> {
    if (!resend) {
      console.warn('[EmailService] Non configuré - email non envoyé:', template.subject);
      return { success: false, error: 'Service email non configuré' };
    }

    try {
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: template.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      if (error) {
        console.error('[EmailService] Erreur envoi:', error);
        return { success: false, error: error.message };
      }

      console.log('[EmailService] Email envoyé à:', template.to);
      return { success: true };
    } catch (err) {
      console.error('[EmailService] Exception:', err);
      return { success: false, error: 'Erreur inattendue' };
    }
  }

  /**
   * Email : Analyse terminée (B2C)
   */
  async sendAnalysisComplete(params: {
    to: string;
    userName: string;
    projectName: string;
    entrepriseName: string;
    grade: string;
    score: number;
    analysisId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const gradeEmoji = this.getGradeEmoji(params.grade);
    const gradeColor = this.getGradeColor(params.grade);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analyse terminée - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Analyse intelligente de devis BTP</p>
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 20px 0;">Bonjour ${params.userName || ''}</h2>

    <p>Votre analyse de devis est terminée !</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #666;">Projet : <strong>${params.projectName || 'Non renseigné'}</strong></p>
      <p style="margin: 0 0 15px 0; color: #666;">Entreprise : <strong>${params.entrepriseName || 'Non renseignée'}</strong></p>

      <div style="display: inline-block; background: ${gradeColor}; color: white; font-size: 48px; font-weight: bold; width: 80px; height: 80px; line-height: 80px; border-radius: 50%; margin: 10px 0;">
        ${params.grade}
      </div>

      <p style="font-size: 24px; font-weight: bold; margin: 15px 0 5px 0;">${params.score}/1000</p>
      <p style="color: #666; margin: 0;">${gradeEmoji} ${this.getGradeLabel(params.grade)}</p>
    </div>

    <div style="text-align: center;">
      <a href="${APP_URL}/results?devisId=${params.analysisId}"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Voir l'analyse complète
      </a>
    </div>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>Vous recevez cet email car vous avez demandé une analyse sur TORP.</p>
    <p>&copy; ${new Date().getFullYear()} TORP - Tous droits réservés</p>
  </div>

</body>
</html>
    `;

    const text = `
Bonjour ${params.userName || ''},

Votre analyse de devis est terminée !

Projet : ${params.projectName || 'Non renseigné'}
Entreprise : ${params.entrepriseName || 'Non renseignée'}
Score : ${params.grade} - ${params.score}/1000

Voir l'analyse : ${APP_URL}/results?devisId=${params.analysisId}

© ${new Date().getFullYear()} TORP
    `;

    return this.send({
      to: params.to,
      subject: `${gradeEmoji} Analyse terminée : ${params.grade} (${params.score}/1000) - TORP`,
      html,
      text,
    });
  }

  /**
   * Email : Bienvenue après inscription
   */
  async sendWelcome(params: {
    to: string;
    userName: string;
    userType: 'B2C' | 'B2B';
  }): Promise<{ success: boolean; error?: string }> {
    const isB2B = params.userType === 'B2B';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bienvenue sur TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 30px;">
    <h2>Bienvenue ${params.userName || ''} !</h2>

    <p>Votre compte ${isB2B ? 'professionnel' : 'particulier'} TORP est maintenant actif.</p>

    ${isB2B ? `
    <p><strong>En tant que professionnel, vous pouvez :</strong></p>
    <ul>
      <li>Analyser vos propres devis avant envoi</li>
      <li>Obtenir des recommandations d'amélioration</li>
      <li>Générer des tickets TORP pour vos clients</li>
      <li>Suivre votre score et votre progression</li>
    </ul>
    ` : `
    <p><strong>Avec TORP, vous pouvez :</strong></p>
    <ul>
      <li>Analyser les devis que vous recevez</li>
      <li>Comprendre les points forts et faibles</li>
      <li>Comparer jusqu'à 3 devis</li>
      <li>Prendre une décision éclairée</li>
    </ul>
    `}

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/${isB2B ? 'pro' : 'dashboard'}"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Accéder à mon espace
      </a>
    </div>

    <p style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 14px;">
      <strong>Astuce :</strong> ${isB2B
        ? 'Complétez votre profil entreprise pour améliorer vos scores.'
        : 'Uploadez votre premier devis pour découvrir la puissance de TORP.'}
    </p>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
    <p>&copy; ${new Date().getFullYear()} TORP - L'analyse intelligente de devis BTP</p>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `Bienvenue sur TORP ${isB2B ? 'Pro' : ''} !`,
      html,
    });
  }

  /**
   * Email : Ticket TORP généré (B2B)
   */
  async sendTicketGenerated(params: {
    to: string;
    userName: string;
    entrepriseName: string;
    referenceDevis: string;
    grade: string;
    score: number;
    ticketCode: string;
    ticketUrl: string;
    pdfUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Votre Ticket TORP est prêt</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP Pro</h1>
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 30px;">
    <h2>Votre Ticket TORP est prêt !</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Le ticket pour votre devis <strong>${params.referenceDevis}</strong> a été généré avec succès.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 10px 0;">Score obtenu</p>
      <div style="display: inline-block; background: ${this.getGradeColor(params.grade)}; color: white; font-size: 36px; font-weight: bold; width: 60px; height: 60px; line-height: 60px; border-radius: 50%;">
        ${params.grade}
      </div>
      <p style="font-size: 20px; font-weight: bold; margin: 10px 0 0 0;">${params.score}/1000</p>
    </div>

    <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-weight: 600;">Code de vérification</p>
      <p style="font-size: 24px; font-family: monospace; margin: 5px 0 0 0; color: #1e40af;">${params.ticketCode}</p>
    </div>

    <p><strong>Comment utiliser votre ticket :</strong></p>
    <ul>
      <li>Téléchargez le PDF et joignez-le à votre devis</li>
      <li>Vos clients peuvent scanner le QR code</li>
      <li>Ou visiter : <a href="${params.ticketUrl}">${params.ticketUrl}</a></li>
    </ul>

    ${params.pdfUrl ? `
    <div style="text-align: center; margin-top: 25px;">
      <a href="${params.pdfUrl}"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Télécharger le ticket PDF
      </a>
    </div>
    ` : ''}
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `Ticket TORP généré - ${params.grade} (${params.score}/1000)`,
      html,
    });
  }

  /**
   * Email : Document expirant (B2B)
   */
  async sendDocumentExpiringSoon(params: {
    to: string;
    userName: string;
    documentType: string;
    expirationDate: string;
    daysRemaining: number;
  }): Promise<{ success: boolean; error?: string }> {
    const urgency = params.daysRemaining <= 7 ? 'URGENT' : params.daysRemaining <= 15 ? 'Important' : 'Rappel';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Document bientôt expiré - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP Pro</h1>
  </div>

  <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 30px;">
    <h2 style="margin: 0 0 15px 0;">${urgency} : Document bientôt expiré</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Votre <strong>${params.documentType}</strong> expire dans <strong>${params.daysRemaining} jour(s)</strong> (le ${params.expirationDate}).</p>

    <p>Pour maintenir votre score TORP et la confiance de vos clients, pensez à mettre à jour ce document.</p>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/pro/documents"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Mettre à jour mes documents
      </a>
    </div>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `${urgency} : Votre ${params.documentType} expire dans ${params.daysRemaining} jour(s)`,
      html,
    });
  }

  // =====================================================
  // EMAILS FRAUDE & SÉCURITÉ
  // =====================================================

  /**
   * Email : Alerte de fraude détectée
   */
  async sendFraudAlert(params: {
    to: string;
    userName: string;
    levelLabel: string;
    montant: number;
    entrepriseName: string;
    rulesTriggered: string[];
    contractId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const ruleLabels: Record<string, string> = {
      ACOMPTE_TRES_ELEVE: 'Acompte anormalement élevé',
      ACOMPTE_EXCESSIF: 'Acompte excessif',
      DEPASSEMENT_CONTRAT: 'Dépassement du montant contractuel',
      PAIEMENTS_RAPIDES: 'Fréquence de paiements inhabituelle',
      NOUVELLE_ENTREPRISE: 'Entreprise récemment créée',
      LITIGE_RECENT: 'Litiges récents avec cette entreprise',
      PREUVES_INSUFFISANTES: 'Preuves de travaux insuffisantes',
      PAIEMENT_PREMATURE: 'Demande de paiement prématurée',
      MONTANT_INCOHERENT: 'Montant incohérent avec le contrat',
    };

    const rulesHtml = params.rulesTriggered
      .map(r => `<li>${ruleLabels[r] || r}</li>`)
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Alerte Sécurité - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Protection anti-arnaque</p>
  </div>

  <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 15px 0; color: #b91c1c;">Alerte Sécurité : ${params.levelLabel}</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Notre système de détection de fraude a identifié des points de vigilance concernant une demande de paiement :</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Entreprise :</strong> ${params.entrepriseName}</p>
      <p style="margin: 0 0 10px 0;"><strong>Montant demandé :</strong> ${params.montant.toLocaleString('fr-FR')}€</p>
      <p style="margin: 0;"><strong>Points d'alerte :</strong></p>
      <ul style="margin: 10px 0; padding-left: 20px;">${rulesHtml}</ul>
    </div>

    <p><strong>Nos recommandations :</strong></p>
    <ul>
      <li>Vérifiez que les travaux correspondent bien aux preuves fournies</li>
      <li>Contactez l'entreprise pour clarifier les points soulevés</li>
      <li>N'approuvez pas ce paiement tant que vous n'êtes pas satisfait</li>
    </ul>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/projects/${params.contractId}"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Voir les détails
      </a>
    </div>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>Cette alerte est générée automatiquement par le système TORP pour votre protection.</p>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `Alerte Sécurité TORP : ${params.levelLabel}`,
      html,
    });
  }

  /**
   * Email : Paiement bloqué
   */
  async sendPaymentBlocked(params: {
    to: string;
    userName: string;
    montant: number;
    entrepriseName: string;
    reason: string;
  }): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paiement Bloqué - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
  </div>

  <div style="background: #fef2f2; border-radius: 12px; padding: 30px;">
    <h2 style="margin: 0 0 15px 0; color: #b91c1c;">Paiement bloqué pour votre protection</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Pour protéger vos intérêts, nous avons bloqué le paiement suivant :</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Montant :</strong> ${params.montant.toLocaleString('fr-FR')}€</p>
      <p style="margin: 0 0 10px 0;"><strong>Entreprise :</strong> ${params.entrepriseName}</p>
      <p style="margin: 0;"><strong>Raison :</strong> ${params.reason}</p>
    </div>

    <p>Ce blocage est une mesure de sécurité. Si vous estimez que ce paiement est légitime, vous pouvez :</p>
    <ul>
      <li>Contacter notre support pour débloquer la situation</li>
      <li>Demander des preuves supplémentaires à l'entreprise</li>
      <li>Ouvrir un litige si vous suspectez une tentative de fraude</li>
    </ul>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/support"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Contacter le support
      </a>
    </div>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `Paiement bloqué - Protection TORP`,
      html,
    });
  }

  // =====================================================
  // EMAILS PAIEMENT
  // =====================================================

  /**
   * Email : Jalon de paiement à venir
   */
  async sendPaymentMilestoneDue(params: {
    to: string;
    userName: string;
    projectName: string;
    milestoneName: string;
    montant: number;
    dueDate: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.dueDate).toLocaleDateString('fr-FR');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Jalon de paiement - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
  </div>

  <div style="background: #fefce8; border: 1px solid #facc15; border-radius: 12px; padding: 30px;">
    <h2 style="margin: 0 0 15px 0;">Jalon de paiement à venir</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Un jalon de paiement arrive bientôt pour votre projet :</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 5px 0; color: #666;">Projet</p>
      <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">${params.projectName}</p>

      <p style="margin: 0 0 5px 0; color: #666;">Jalon</p>
      <p style="margin: 0 0 15px 0; font-weight: 600;">${params.milestoneName}</p>

      <div style="display: inline-block; background: #22c55e; color: white; padding: 10px 20px; border-radius: 8px; font-size: 24px; font-weight: bold;">
        ${params.montant.toLocaleString('fr-FR')}€
      </div>

      <p style="margin: 15px 0 0 0; color: #666;">Prévu le <strong>${dateFormatted}</strong></p>
    </div>

    <p>Assurez-vous que les travaux correspondants sont bien terminés avant d'approuver ce paiement.</p>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/projects"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Voir mon projet
      </a>
    </div>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `Jalon de paiement : ${params.milestoneName} - ${params.montant.toLocaleString('fr-FR')}€`,
      html,
    });
  }

  /**
   * Email : Paiement libéré
   */
  async sendPaymentReleased(params: {
    to: string;
    userName: string;
    projectName: string;
    montant: number;
    entrepriseName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paiement libéré - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
  </div>

  <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 30px;">
    <h2 style="margin: 0 0 15px 0; color: #166534;">Paiement libéré avec succès</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Le paiement suivant a été effectué :</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <div style="display: inline-block; background: #22c55e; color: white; padding: 15px 30px; border-radius: 8px; font-size: 28px; font-weight: bold;">
        ${params.montant.toLocaleString('fr-FR')}€
      </div>

      <p style="margin: 15px 0 5px 0; color: #666;">Projet</p>
      <p style="margin: 0 0 10px 0; font-weight: 600;">${params.projectName}</p>

      <p style="margin: 0 0 5px 0; color: #666;">Versé à</p>
      <p style="margin: 0; font-weight: 600;">${params.entrepriseName}</p>
    </div>

    <p>Ce paiement est définitif. Conservez cet email comme preuve de transaction.</p>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `Paiement effectué : ${params.montant.toLocaleString('fr-FR')}€ - ${params.projectName}`,
      html,
    });
  }

  // =====================================================
  // SMS VIA TWILIO
  // =====================================================

  /**
   * Vérifie si le service SMS est configuré
   */
  isSMSConfigured(): boolean {
    return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
  }

  /**
   * Envoie un SMS via Twilio
   */
  async sendSMS(params: {
    to: string;
    message: string;
  }): Promise<{ success: boolean; error?: string; sid?: string }> {
    if (!this.isSMSConfigured()) {
      console.warn('[EmailService] SMS non configuré - SMS non envoyé:', params.message);
      return { success: false, error: 'Service SMS non configuré' };
    }

    try {
      // Formater le numéro de téléphone
      let phoneNumber = params.to.replace(/\s/g, '');
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '+33' + phoneNumber.slice(1);
      }
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber;
      }

      // Appel API Twilio
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phoneNumber,
            From: TWILIO_PHONE_NUMBER!,
            Body: params.message,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[EmailService] Erreur Twilio:', data);
        return { success: false, error: data.message || 'Erreur envoi SMS' };
      }

      console.log('[EmailService] SMS envoyé à:', phoneNumber, 'SID:', data.sid);
      return { success: true, sid: data.sid };
    } catch (err) {
      console.error('[EmailService] Exception SMS:', err);
      return { success: false, error: 'Erreur inattendue' };
    }
  }

  /**
   * SMS : Alerte de fraude
   */
  async sendFraudAlertSMS(params: {
    to: string;
    montant: number;
    entrepriseName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const message = `[TORP] Alerte sécurité : Demande de paiement suspecte de ${params.montant.toLocaleString('fr-FR')}€ par ${params.entrepriseName}. Connectez-vous pour vérifier.`;
    return this.sendSMS({ to: params.to, message });
  }

  /**
   * SMS : Jalon de paiement
   */
  async sendPaymentMilestoneSMS(params: {
    to: string;
    projectName: string;
    montant: number;
    dueDate: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.dueDate).toLocaleDateString('fr-FR');
    const message = `[TORP] Rappel : Jalon de ${params.montant.toLocaleString('fr-FR')}€ prévu le ${dateFormatted} pour "${params.projectName}".`;
    return this.sendSMS({ to: params.to, message });
  }

  // =====================================================
  // EMAILS PHASE 4 - RÉCEPTION & GARANTIES
  // =====================================================

  /**
   * Email : Rappel d'entretien (Phase 4)
   */
  async sendRappelEntretien(params: {
    to: string;
    userName: string;
    projectName: string;
    equipement: string;
    typeEntretien: string;
    datePreconisee: string;
    frequence: string;
    prestataireSuggere?: string;
    chantierId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.datePreconisee).toLocaleDateString('fr-FR');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rappel d'entretien - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Suivi de garanties & entretien</p>
  </div>

  <div style="background: #fefce8; border: 1px solid #facc15; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 15px 0;">Rappel d'entretien prévu</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Un entretien est à prévoir pour maintenir vos garanties sur le projet <strong>${params.projectName}</strong> :</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Équipement :</strong> ${params.equipement}</p>
      <p style="margin: 0 0 10px 0;"><strong>Type d'entretien :</strong> ${params.typeEntretien}</p>
      <p style="margin: 0 0 10px 0;"><strong>Date préconisée :</strong> ${dateFormatted}</p>
      <p style="margin: 0;"><strong>Fréquence :</strong> ${params.frequence}</p>
      ${params.prestataireSuggere ? `<p style="margin: 10px 0 0 0;"><strong>Prestataire suggéré :</strong> ${params.prestataireSuggere}</p>` : ''}
    </div>

    <p style="color: #92400e;">Important : Le défaut d'entretien peut entraîner la déchéance de certaines garanties.</p>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/chantiers/${params.chantierId}/carnet-sante"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Voir le carnet de santé
      </a>
    </div>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>Ce rappel est généré automatiquement par TORP pour préserver vos garanties.</p>
  </div>

</body>
</html>
    `;

    const text = `
Bonjour ${params.userName || ''},

Rappel d'entretien pour le projet "${params.projectName}" :

- Équipement : ${params.equipement}
- Type d'entretien : ${params.typeEntretien}
- Date préconisée : ${dateFormatted}
- Fréquence : ${params.frequence}
${params.prestataireSuggere ? `- Prestataire suggéré : ${params.prestataireSuggere}` : ''}

Important : Le défaut d'entretien peut entraîner la déchéance de certaines garanties.

Voir le carnet de santé : ${APP_URL}/chantiers/${params.chantierId}/carnet-sante

© ${new Date().getFullYear()} TORP
    `;

    return this.send({
      to: params.to,
      subject: `Rappel entretien : ${params.equipement} - ${params.projectName}`,
      html,
      text,
    });
  }

  /**
   * Email : DOE remis (Phase 4)
   */
  async sendDOERemis(params: {
    to: string;
    userName: string;
    projectName: string;
    documentsCount: number;
    documentsManquants: string[];
    dateReception: string;
    chantierId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.dateReception).toLocaleDateString('fr-FR');
    const manquantsHtml = params.documentsManquants.length > 0
      ? `<div style="background: #fef2f2; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0; color: #b91c1c;"><strong>Documents manquants (${params.documentsManquants.length}) :</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            ${params.documentsManquants.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>`
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DOE Remis - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Dossier des Ouvrages Exécutés</p>
  </div>

  <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 15px 0; color: #166534;">DOE reçu pour votre projet</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Le Dossier des Ouvrages Exécutés (DOE) pour le projet <strong>${params.projectName}</strong> a été remis.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #666;">Documents reçus</p>
      <p style="font-size: 36px; font-weight: bold; margin: 0; color: #22c55e;">${params.documentsCount}</p>
      <p style="margin: 10px 0 0 0; color: #666;">Réception le ${dateFormatted}</p>
    </div>

    ${manquantsHtml}

    <p><strong>Le DOE contient :</strong></p>
    <ul>
      <li>Plans de recollement</li>
      <li>Notices techniques des équipements</li>
      <li>Certificats de conformité</li>
      <li>Garanties fabricants</li>
    </ul>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/chantiers/${params.chantierId}/doe"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Consulter le DOE complet
      </a>
    </div>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>Conservez précieusement ce dossier pour toute la durée des garanties.</p>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `DOE reçu : ${params.documentsCount} documents - ${params.projectName}`,
      html,
    });
  }

  /**
   * Email : Relance réserve (Phase 4)
   */
  async sendReserveRelance(params: {
    to: string;
    userName: string;
    projectName: string;
    reserveDescription: string;
    lot: string;
    dateLevee: string;
    joursRetard: number;
    entreprise: string;
    chantierId: string;
    reserveId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.dateLevee).toLocaleDateString('fr-FR');
    const urgencyColor = params.joursRetard > 15 ? '#b91c1c' : params.joursRetard > 7 ? '#d97706' : '#ca8a04';
    const urgencyLabel = params.joursRetard > 15 ? 'URGENT' : params.joursRetard > 7 ? 'Important' : 'Rappel';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relance Réserve - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Suivi des réserves</p>
  </div>

  <div style="background: #fefce8; border: 2px solid ${urgencyColor}; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 15px 0; color: ${urgencyColor};">${urgencyLabel} : Réserve non levée</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Une réserve du projet <strong>${params.projectName}</strong> n'a pas encore été levée :</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Description :</strong> ${params.reserveDescription}</p>
      <p style="margin: 0 0 10px 0;"><strong>Lot concerné :</strong> ${params.lot}</p>
      <p style="margin: 0 0 10px 0;"><strong>Entreprise responsable :</strong> ${params.entreprise}</p>
      <p style="margin: 0 0 10px 0;"><strong>Date de levée prévue :</strong> ${dateFormatted}</p>
      <p style="margin: 0; color: ${urgencyColor};"><strong>Retard :</strong> ${params.joursRetard} jour(s)</p>
    </div>

    <p><strong>Actions recommandées :</strong></p>
    <ul>
      <li>Contacter l'entreprise ${params.entreprise} pour obtenir une date d'intervention</li>
      <li>Documenter tout échange concernant cette réserve</li>
      ${params.joursRetard > 15 ? '<li style="color: #b91c1c;">Envisager une mise en demeure si pas de réponse</li>' : ''}
    </ul>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/chantiers/${params.chantierId}/reserves/${params.reserveId}"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Voir la réserve
      </a>
    </div>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>La retenue de garantie ne pourra être libérée qu'après levée de toutes les réserves.</p>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `${urgencyLabel} : Réserve non levée (${params.joursRetard}j) - ${params.projectName}`,
      html,
    });
  }

  /**
   * Email : Expiration de garantie (Phase 4)
   */
  async sendGarantieExpiration(params: {
    to: string;
    userName: string;
    projectName: string;
    typeGarantie: string;
    dateExpiration: string;
    joursRestants: number;
    lotsConcernes: string[];
    chantierId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.dateExpiration).toLocaleDateString('fr-FR');
    const urgencyColor = params.joursRestants <= 30 ? '#b91c1c' : params.joursRestants <= 90 ? '#d97706' : '#2563eb';
    const urgencyLabel = params.joursRestants <= 30 ? 'URGENT' : params.joursRestants <= 90 ? 'Attention' : 'Information';

    const garantieLabels: Record<string, string> = {
      parfait_achevement: 'Garantie de Parfait Achèvement (1 an)',
      biennale: 'Garantie Biennale (2 ans)',
      decennale: 'Garantie Décennale (10 ans)',
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Expiration de Garantie - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Suivi des garanties</p>
  </div>

  <div style="background: #fef2f2; border: 2px solid ${urgencyColor}; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 15px 0; color: ${urgencyColor};">${urgencyLabel} : Garantie bientôt expirée</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Une garantie du projet <strong>${params.projectName}</strong> expire bientôt :</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">${garantieLabels[params.typeGarantie] || params.typeGarantie}</p>
      <p style="margin: 0 0 15px 0; color: #666;">Expire le <strong>${dateFormatted}</strong></p>
      <div style="display: inline-block; background: ${urgencyColor}; color: white; padding: 10px 25px; border-radius: 8px; font-size: 24px; font-weight: bold;">
        ${params.joursRestants} jour(s) restants
      </div>
    </div>

    <p><strong>Lots concernés :</strong></p>
    <ul>
      ${params.lotsConcernes.map(lot => `<li>${lot}</li>`).join('')}
    </ul>

    <p><strong>Actions recommandées avant expiration :</strong></p>
    <ul>
      <li>Inspecter les ouvrages concernés</li>
      <li>Signaler tout désordre ou malfaçon identifié</li>
      <li>Documenter l'état actuel avec photos</li>
      ${params.typeGarantie === 'parfait_achevement' ? '<li>Vérifier que toutes les réserves ont été levées</li>' : ''}
    </ul>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/chantiers/${params.chantierId}/garanties"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Voir mes garanties
      </a>
    </div>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>Passé la date d'expiration, les désordres ne pourront plus être couverts par cette garantie.</p>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `${urgencyLabel} : ${garantieLabels[params.typeGarantie] || params.typeGarantie} expire dans ${params.joursRestants}j`,
      html,
    });
  }

  /**
   * Email : Sinistre déclaré (Phase 4)
   */
  async sendSinistreDeclare(params: {
    to: string;
    userName: string;
    projectName: string;
    sinistreReference: string;
    description: string;
    dateConstat: string;
    garantieApplicable: string;
    entrepriseResponsable: string;
    prochainEtape: string;
    chantierId: string;
    sinistreId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.dateConstat).toLocaleDateString('fr-FR');

    const garantieLabels: Record<string, string> = {
      parfait_achevement: 'Garantie de Parfait Achèvement',
      biennale: 'Garantie Biennale',
      decennale: 'Garantie Décennale',
      hors_garantie: 'Hors garantie',
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sinistre Déclaré - TORP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #DC2626; margin: 0;">TORP</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Gestion des sinistres</p>
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 15px 0;">Confirmation de déclaration de sinistre</h2>

    <p>Bonjour ${params.userName || ''},</p>

    <p>Votre déclaration de sinistre pour le projet <strong>${params.projectName}</strong> a bien été enregistrée.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Référence :</strong> ${params.sinistreReference}</p>
      <p style="margin: 0 0 10px 0;"><strong>Description :</strong> ${params.description}</p>
      <p style="margin: 0 0 10px 0;"><strong>Date de constat :</strong> ${dateFormatted}</p>
      <p style="margin: 0 0 10px 0;"><strong>Garantie applicable :</strong> ${garantieLabels[params.garantieApplicable] || params.garantieApplicable}</p>
      <p style="margin: 0;"><strong>Entreprise responsable :</strong> ${params.entrepriseResponsable}</p>
    </div>

    <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Prochaine étape :</strong> ${params.prochainEtape}</p>
    </div>

    <p><strong>Documents à conserver :</strong></p>
    <ul>
      <li>Photos des désordres constatés</li>
      <li>Copie des échanges avec l'entreprise</li>
      <li>Devis de réparation si disponible</li>
      <li>Rapports d'expertise éventuels</li>
    </ul>

    <div style="text-align: center; margin-top: 25px;">
      <a href="${APP_URL}/chantiers/${params.chantierId}/sinistres/${params.sinistreId}"
         style="display: inline-block; background: #DC2626; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
        Suivre mon sinistre
      </a>
    </div>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px;">
    <p>TORP vous accompagne dans la gestion de vos sinistres et garanties.</p>
  </div>

</body>
</html>
    `;

    return this.send({
      to: params.to,
      subject: `Sinistre enregistré : ${params.sinistreReference} - ${params.projectName}`,
      html,
    });
  }

  /**
   * SMS : Rappel d'entretien (Phase 4)
   */
  async sendRappelEntretienSMS(params: {
    to: string;
    equipement: string;
    projectName: string;
    datePreconisee: string;
  }): Promise<{ success: boolean; error?: string }> {
    const dateFormatted = new Date(params.datePreconisee).toLocaleDateString('fr-FR');
    const message = `[TORP] Rappel entretien : ${params.equipement} sur "${params.projectName}" prévu le ${dateFormatted}. Maintenez vos garanties !`;
    return this.sendSMS({ to: params.to, message });
  }

  /**
   * SMS : Expiration garantie (Phase 4)
   */
  async sendGarantieExpirationSMS(params: {
    to: string;
    typeGarantie: string;
    projectName: string;
    joursRestants: number;
  }): Promise<{ success: boolean; error?: string }> {
    const garantieLabels: Record<string, string> = {
      parfait_achevement: 'Parfait Achèvement',
      biennale: 'Biennale',
      decennale: 'Décennale',
    };
    const message = `[TORP] ALERTE : Garantie ${garantieLabels[params.typeGarantie] || params.typeGarantie} expire dans ${params.joursRestants}j sur "${params.projectName}". Vérifiez vos ouvrages !`;
    return this.sendSMS({ to: params.to, message });
  }

  // Helpers
  private getGradeEmoji(grade: string): string {
    switch (grade) {
      case 'A+':
      case 'A':
        return '';
      case 'B':
        return '';
      case 'C':
        return '';
      case 'D':
        return '';
      case 'E':
      case 'F':
        return '';
      default:
        return '';
    }
  }

  private getGradeLabel(grade: string): string {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'Excellent';
      case 'B':
        return 'Bon';
      case 'C':
        return 'Correct';
      case 'D':
        return 'Insuffisant';
      case 'E':
      case 'F':
        return 'Critique';
      default:
        return '';
    }
  }

  private getGradeColor(grade: string): string {
    switch (grade) {
      case 'A+':
      case 'A':
        return '#22c55e';
      case 'B':
        return '#4ade80';
      case 'C':
        return '#facc15';
      case 'D':
        return '#f97316';
      case 'E':
      case 'F':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }
}

export const emailService = new EmailService();
export default emailService;
