/**
 * Pappers Proxy Service
 * Calls Supabase Edge Function (pappers-proxy) to securely access Pappers API
 * API key is only exposed server-side, never in frontend code
 */

import { supabase } from '@/lib/supabase';

export interface PappersProxyResponse {
  siret?: string;
  siren?: string;
  nom_entreprise?: string;
  denomination?: string;
  forme_juridique?: string;
  code_naf?: string;
  libelle_code_naf?: string;
  date_creation?: string;
  capitale?: number;
  entreprise_cessee?: boolean;
  effectif?: string;
  adresse?: string;
  [key: string]: any;
}

class PappersProxyService {
  /**
   * Search company by SIRET using Edge Function proxy
   * @param siret 14-digit SIRET number
   * @returns Company data or null if not found
   */
  async searchCompanyBySiret(siret: string): Promise<PappersProxyResponse | null> {
    try {
      // Validate SIRET format
      const cleanedSiret = siret.replace(/\s/g, '');
      if (!/^\d{14}$/.test(cleanedSiret)) {
        console.warn(`[PappersProxy] Invalid SIRET format: ${siret}`);
        return null;
      }

      console.log(`[PappersProxy] Searching company: ${cleanedSiret}`);

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('pappers-proxy', {
        body: { siret: cleanedSiret },
      });

      if (error) {
        console.error(`[PappersProxy] Edge Function error:`, error);
        return null;
      }

      if (!data) {
        console.warn(`[PappersProxy] No data returned for SIRET: ${cleanedSiret}`);
        return null;
      }

      // Check for error response from Edge Function
      if (data.error) {
        console.error(`[PappersProxy] API error: ${data.error}`);
        return null;
      }

      console.log(`[PappersProxy] Successfully fetched data for SIRET: ${cleanedSiret}`);
      return data;
    } catch (error) {
      console.error(`[PappersProxy] Error:`, error);
      return null;
    }
  }

  /**
   * Check if Pappers integration is available
   * Since we use Edge Function, this just returns true
   * (Edge Function will handle API key validation)
   */
  isConfigured(): boolean {
    return true; // Edge Function handles configuration server-side
  }
}

export const pappersProxyService = new PappersProxyService();
export default pappersProxyService;
