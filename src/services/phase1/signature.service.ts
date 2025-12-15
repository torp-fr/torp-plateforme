/**
 * SignatureService - Service de gestion des signatures
 *
 * Prépare l'intégration future avec un fournisseur de signature électronique
 * (Yousign, DocuSign, etc.)
 *
 * Mode actuel: Manuel (upload de documents signés)
 */

import { supabase } from '@/integrations/supabase/client';

export type SignatureProvider = 'yousign' | 'docusign' | 'manual';
export type SignataireType = 'maitre_ouvrage' | 'entreprise';
export type SignatureStatus = 'pending' | 'signed' | 'refused' | 'expired' | 'cancelled';
export type SignatureMethod = 'manuscrite' | 'electronique_simple' | 'electronique_avancee' | 'electronique_qualifiee';

export interface Signataire {
  nom: string;
  prenom?: string;
  email: string;
  telephone?: string;
  fonction?: string;
}

export interface SignatureRequest {
  contratId: string;
  signataireType: SignataireType;
  signataire: Signataire;
  documentUrl?: string;
  method?: SignatureMethod;
  expiresInDays?: number;
}

export interface SignatureResult {
  success: boolean;
  signatureId?: string;
  signedAt?: string;
  signatureUrl?: string;
  error?: string;
}

export interface SignatureRecord {
  id: string;
  contratId: string;
  signataireType: SignataireType;
  signataire: Signataire;
  status: SignatureStatus;
  method: SignatureMethod;
  signedAt?: string;
  signedDocumentPath?: string;
  externalSignatureId?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

class SignatureService {
  private provider: SignatureProvider = 'manual';

  /**
   * Configure le fournisseur de signature
   */
  setProvider(provider: SignatureProvider): void {
    this.provider = provider;
  }

  /**
   * Récupère le fournisseur actuel
   */
  getProvider(): SignatureProvider {
    return this.provider;
  }

  /**
   * Initier une demande de signature
   */
  async requestSignature(request: SignatureRequest): Promise<SignatureResult> {
    try {
      switch (this.provider) {
        case 'yousign':
          return this.requestYousignSignature(request);
        case 'docusign':
          return this.requestDocusignSignature(request);
        case 'manual':
        default:
          return this.requestManualSignature(request);
      }
    } catch (error) {
      console.error('Erreur demande de signature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Vérifier le statut d'une signature
   */
  async checkSignatureStatus(signatureId: string): Promise<{
    status: SignatureStatus;
    signedAt?: string;
    expiresAt?: string;
  }> {
    const { data, error } = await supabase
      .from('phase1_signatures')
      .select('status, signed_at, expires_at')
      .eq('id', signatureId)
      .single();

    if (error) {
      console.error('Erreur récupération statut:', error);
      return { status: 'pending' };
    }

    return {
      status: data?.status || 'pending',
      signedAt: data?.signed_at,
      expiresAt: data?.expires_at,
    };
  }

  /**
   * Récupérer toutes les signatures d'un contrat
   */
  async getContractSignatures(contratId: string): Promise<SignatureRecord[]> {
    const { data, error } = await supabase
      .from('phase1_signatures')
      .select('*')
      .eq('contrat_id', contratId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erreur récupération signatures:', error);
      return [];
    }

    return (data || []).map(this.mapRowToSignature);
  }

  /**
   * Confirmer une signature manuelle (avec upload du document signé)
   */
  async confirmManualSignature(
    signatureId: string,
    signedDocumentPath: string
  ): Promise<SignatureResult> {
    const { data, error } = await supabase
      .from('phase1_signatures')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_document_path: signedDocumentPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signatureId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Mettre à jour le contrat si toutes les signatures sont complètes
    await this.updateContractStatusIfComplete(data.contrat_id);

    return {
      success: true,
      signatureId,
      signedAt: data.signed_at,
    };
  }

  /**
   * Annuler une demande de signature
   */
  async cancelSignatureRequest(signatureId: string): Promise<SignatureResult> {
    const { error } = await supabase
      .from('phase1_signatures')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', signatureId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, signatureId };
  }

  /**
   * Relancer une demande de signature expirée
   */
  async resendSignatureRequest(signatureId: string): Promise<SignatureResult> {
    const { data: existing } = await supabase
      .from('phase1_signatures')
      .select('*')
      .eq('id', signatureId)
      .single();

    if (!existing) {
      return { success: false, error: 'Signature non trouvée' };
    }

    // Annuler l'ancienne demande
    await this.cancelSignatureRequest(signatureId);

    // Créer une nouvelle demande
    return this.requestSignature({
      contratId: existing.contrat_id,
      signataireType: existing.signataire_type,
      signataire: existing.signataire,
      method: existing.method,
    });
  }

  // ================== MÉTHODES PRIVÉES ==================

  /**
   * Signature manuelle (mode par défaut)
   */
  private async requestManualSignature(request: SignatureRequest): Promise<SignatureResult> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (request.expiresInDays || 30));

    const { data, error } = await supabase
      .from('phase1_signatures')
      .insert({
        contrat_id: request.contratId,
        signataire_type: request.signataireType,
        signataire: request.signataire,
        status: 'pending',
        method: request.method || 'manuscrite',
        expires_at: expiresAt.toISOString(),
        metadata: {
          provider: 'manual',
          requestedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      signatureId: data.id,
    };
  }

  /**
   * Signature Yousign (préparation pour intégration future)
   */
  private async requestYousignSignature(request: SignatureRequest): Promise<SignatureResult> {
    // TODO: Implémenter l'intégration Yousign
    // - Créer une procédure de signature
    // - Ajouter le signataire
    // - Uploader le document
    // - Envoyer la demande

    console.warn('Intégration Yousign non implémentée - utilisation du mode manuel');

    // Fallback vers manuel
    return this.requestManualSignature({
      ...request,
      method: 'electronique_avancee',
    });
  }

  /**
   * Signature DocuSign (préparation pour intégration future)
   */
  private async requestDocusignSignature(request: SignatureRequest): Promise<SignatureResult> {
    // TODO: Implémenter l'intégration DocuSign
    // - Créer une enveloppe
    // - Ajouter le document
    // - Définir les signataires
    // - Envoyer l'enveloppe

    console.warn('Intégration DocuSign non implémentée - utilisation du mode manuel');

    // Fallback vers manuel
    return this.requestManualSignature({
      ...request,
      method: 'electronique_avancee',
    });
  }

  /**
   * Mettre à jour le statut du contrat si toutes les signatures sont complètes
   */
  private async updateContractStatusIfComplete(contratId: string): Promise<void> {
    const { data: signatures } = await supabase
      .from('phase1_signatures')
      .select('signataire_type, status')
      .eq('contrat_id', contratId);

    if (!signatures || signatures.length === 0) return;

    const moSignature = signatures.find(s => s.signataire_type === 'maitre_ouvrage');
    const entrepriseSignature = signatures.find(s => s.signataire_type === 'entreprise');

    let newStatus: string | null = null;

    if (entrepriseSignature?.status === 'signed' && moSignature?.status === 'signed') {
      // Les deux parties ont signé
      newStatus = 'notifie';
    } else if (moSignature?.status === 'signed') {
      // Seul le MOA a signé
      newStatus = 'signe_mo';
    } else if (entrepriseSignature?.status === 'signed') {
      // Seule l'entreprise a signé
      newStatus = 'signe_entreprise';
    }

    if (newStatus) {
      await supabase
        .from('phase1_contrats')
        .update({
          statut: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contratId);
    }
  }

  /**
   * Mapper une ligne DB vers l'interface SignatureRecord
   */
  private mapRowToSignature(row: any): SignatureRecord {
    return {
      id: row.id,
      contratId: row.contrat_id,
      signataireType: row.signataire_type,
      signataire: row.signataire,
      status: row.status,
      method: row.method,
      signedAt: row.signed_at,
      signedDocumentPath: row.signed_document_path,
      externalSignatureId: row.external_signature_id,
      expiresAt: row.expires_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const signatureService = new SignatureService();
