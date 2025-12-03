/**
 * Email Service
 * Service d'envoi d'emails transactionnels via Resend
 */

import { Resend } from 'resend';

const resend = import.meta.env.VITE_RESEND_API_KEY
  ? new Resend(import.meta.env.VITE_RESEND_API_KEY)
  : null;

const EMAIL_FROM = import.meta.env.VITE_EMAIL_FROM || 'TORP <noreply@torp.fr>';
const APP_URL = import.meta.env.VITE_APP_URL || 'https://torp.fr';

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
