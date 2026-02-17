/**
 * Service Supabase - Gestion données enrichies, CCF, analyses
 * REFACTORED: Uses centralized Supabase client from /lib/supabase.ts
 *
 * ⚠️ SINGLE SOURCE OF TRUTH
 * This service does NOT instantiate Supabase.
 * It imports the centralized client instead.
 */

import { supabase } from '@/lib/supabase';
import type { CCFData } from '@/components/guided-ccf/GuidedCCF';
import type { EnrichedClientData } from '@/types/enrichment';

// ============================================================================
// TYPES
// ============================================================================

interface SupabaseCCF {
  id: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_address_number?: string;
  client_address_street: string;
  client_address_city: string;
  client_address_postal_code: string;
  project_name: string;
  project_type: string;
  scope: string;
  budget: number;
  timeline: string;
  objectives: string[];
  constraints: string[];
  success_criteria: string[];
  company_name?: string;
  company_siret?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SupabaseEnrichedData {
  id: string;
  ccf_id: string;
  address_text: string;
  latitude?: number;
  longitude?: number;
  dpe_class?: string;
  dpe_consumption?: number;
  dpe_emissions?: number;
  cadastre_parcel_number?: string;
  cadastre_year_construction?: number;
  cadastre_building_type?: string;
  cadastre_total_surface?: number;
  regulatory_abf_zone: boolean;
  regulatory_floodable_zone: boolean;
  regulatory_seismic_zone?: string;
  embedding?: number[];
  enrichment_status: string;
  enriched_at?: string;
}

// ============================================================================
// CCF OPERATIONS
// ============================================================================

export async function createCCF(data: CCFData): Promise<SupabaseCCF | null> {
  try {
    const ccfData: Partial<SupabaseCCF> = {
      client_name: data.clientName,
      client_phone: data.clientPhone,
      client_email: data.clientEmail,
      client_address_number: data.projectAddress?.number,
      client_address_street: data.projectAddress?.street || '',
      client_address_city: data.projectAddress?.city || '',
      client_address_postal_code: data.projectAddress?.postalCode || '',
      project_name: data.projectName,
      project_type: data.projectType,
      scope: data.scope,
      budget: data.budget,
      timeline: data.timeline,
      objectives: data.objectives || [],
      constraints: data.constraints || [],
      success_criteria: data.successCriteria || [],
      company_name: data.company,
      company_siret: data.siret,
      status: 'draft',
    };

    const { data: created, error } = await supabase
      .from('ccf')
      .insert([ccfData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating CCF:', error);
      return null;
    }

    console.log('✅ CCF created in Supabase:', created);
    return created;
  } catch (error) {
    console.error('❌ CCF creation error:', error);
    return null;
  }
}

export async function getCCF(id: string): Promise<SupabaseCCF | null> {
  try {
    const { data, error } = await supabase
      .from('ccf')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching CCF:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ CCF fetch error:', error);
    return null;
  }
}

export async function updateCCF(id: string, updates: Partial<SupabaseCCF>): Promise<SupabaseCCF | null> {
  try {
    const { data, error } = await supabase
      .from('ccf')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating CCF:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ CCF update error:', error);
    return null;
  }
}

// ============================================================================
// ENRICHED DATA OPERATIONS
// ============================================================================

export async function storeEnrichedData(
  ccfId: string,
  enrichedData: EnrichedClientData
): Promise<SupabaseEnrichedData | null> {
  try {
    const storedData: Partial<SupabaseEnrichedData> = {
      ccf_id: ccfId,
      address_text: enrichedData.addressText,
      latitude: enrichedData.coordinates?.latitude,
      longitude: enrichedData.coordinates?.longitude,

      // DPE
      dpe_class: enrichedData.dpe?.class,
      dpe_consumption: enrichedData.dpe?.consumption,
      dpe_emissions: enrichedData.dpe?.emissions,

      // Cadastre
      cadastre_parcel_number: enrichedData.cadastre?.parcelleNumber,
      cadastre_year_construction: enrichedData.cadastre?.yearConstruction,
      cadastre_building_type: enrichedData.cadastre?.buildingType,
      cadastre_total_surface: enrichedData.cadastre?.totalSurface,

      // Réglementaire
      regulatory_abf_zone: enrichedData.regulatory?.abfZone || false,
      regulatory_floodable_zone: enrichedData.regulatory?.floodableZone || false,
      regulatory_seismic_zone: enrichedData.regulatory?.seismicZone,

      // Embedding
      embedding: enrichedData.embedding,

      // Status
      enrichment_status: enrichedData.enrichmentStatus,
      enriched_at: enrichedData.lastUpdated,
    };

    const { data, error } = await supabase
      .from('client_enriched_data')
      .insert([storedData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error storing enriched data:', error);
      return null;
    }

    console.log('✅ Enriched data stored:', data);
    return data;
  } catch (error) {
    console.error('❌ Enriched data store error:', error);
    return null;
  }
}

export async function getEnrichedData(ccfId: string): Promise<SupabaseEnrichedData | null> {
  try {
    const { data, error } = await supabase
      .from('client_enriched_data')
      .select('*')
      .eq('ccf_id', ccfId)
      .order('enriched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Error fetching enriched data:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Enriched data fetch error:', error);
    return null;
  }
}

// ============================================================================
// RAG SEARCH (Vector Similarity Search)
// ============================================================================

export async function searchEnrichedDataByEmbedding(
  embedding: number[],
  limit: number = 5,
  similarity_threshold: number = 0.7
): Promise<SupabaseEnrichedData[]> {
  try {
    const { data, error } = await supabase.rpc('match_enriched_data', {
      query_embedding: embedding,
      match_count: limit,
      match_threshold: similarity_threshold,
    });

    if (error) {
      console.error('❌ Error searching enriched data:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Enriched data search error:', error);
    return [];
  }
}

// ============================================================================
// QUOTE UPLOADS
// ============================================================================

export async function uploadQuotePDF(
  ccfId: string,
  file: File,
  uploadedBy: string
): Promise<string | null> {
  try {
    // Sanitize filename - remove special characters that Supabase Storage rejects
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .toLowerCase();

    // Upload fichier à Supabase Storage
    const filePath = `ccf/${ccfId}/${Date.now()}_${sanitizedName}`;

    console.log('🔄 [uploadQuotePDF] Uploading to storage:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('quote-uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ [uploadQuotePDF] Storage upload error:', uploadError);
      throw new Error(`Storage error: ${uploadError.message}`);
    }

    console.log('✅ [uploadQuotePDF] File uploaded to storage');

    // Créer enregistrement DB
    const { data: urlData } = supabase.storage
      .from('quote-uploads')
      .getPublicUrl(filePath);

    console.log('🔄 [uploadQuotePDF] Creating database record...');

    const { data: record, error: dbError } = await supabase
      .from('quote_uploads')
      .insert([
        {
          ccf_id: ccfId,
          filename: file.name,
          file_size: file.size,
          file_path: filePath,
          file_url: urlData?.publicUrl,
          uploaded_by: uploadedBy,
          processing_status: 'pending',
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('❌ [uploadQuotePDF] DB insert error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log('✅ [uploadQuotePDF] Quote uploaded successfully:', record.id);
    return record.id;
  } catch (error) {
    console.error('❌ [uploadQuotePDF] Upload error:', error);
    throw error; // Re-throw so caller can handle
  }
}

// ============================================================================
// ANALYSIS
// ============================================================================

export async function createAnalysis(
  ccfId: string,
  quoteUploadId: string,
  analysis: {
    conformity_score: number;
    overall_score: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    alerts: any[];
    recommendations: any[];
    abf_alert?: boolean;
    flood_alert?: boolean;
    seismic_alert?: boolean;
    budget_vs_market_ratio?: number;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('quote_analysis')
      .insert([
        {
          ccf_id: ccfId,
          quote_upload_id: quoteUploadId,
          conformity_score: analysis.conformity_score,
          overall_score: analysis.overall_score,
          status: analysis.status,
          alerts: analysis.alerts,
          recommendations: analysis.recommendations,
          abf_alert: analysis.abf_alert || false,
          flood_alert: analysis.flood_alert || false,
          seismic_alert: analysis.seismic_alert || false,
          budget_vs_market_ratio: analysis.budget_vs_market_ratio,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating analysis:', error);
      return null;
    }

    console.log('✅ Analysis created:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ Analysis creation error:', error);
    return null;
  }
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export async function logAction(
  ccfId: string,
  action: string,
  details?: any,
  status: 'success' | 'failed' | 'partial' = 'success',
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('audit_log').insert([
      {
        ccf_id: ccfId,
        action,
        details,
        status,
        error_message: errorMessage,
      },
    ]);
  } catch (error) {
    console.error('❌ Audit log error:', error);
  }
}

// ============================================================================
// MIGRATION: localStorage → Supabase
// ============================================================================

export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    // Récupérer données localStorage
    const ccfJson = localStorage.getItem('currentCCF');
    const enrichedJson = localStorage.getItem('enrichedClientData');

    if (!ccfJson) {
      console.warn('⚠️ No CCF data in localStorage');
      return false;
    }

    const ccfData = JSON.parse(ccfJson) as CCFData & { enrichedData?: EnrichedClientData };
    const enrichedData = ccfData.enrichedData || (enrichedJson ? JSON.parse(enrichedJson) : null);

    console.log('📤 Migrating from localStorage...');

    // Créer CCF dans Supabase
    const createdCCF = await createCCF(ccfData);
    if (!createdCCF) throw new Error('Failed to create CCF');

    // Stocker données enrichies si disponibles
    if (enrichedData) {
      await storeEnrichedData(createdCCF.id, enrichedData);
    }

    // Log action
    await logAction(createdCCF.id, 'migration_from_localstorage', {
      has_enrichment: !!enrichedData,
    });

    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration error:', error);
    return false;
  }
}

// Re-export centralized client for backwards compatibility
export { supabase };

export default supabase;


// ============================================================================
// TYPES
// ============================================================================

interface SupabaseCCF {
  id: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_address_number?: string;
  client_address_street: string;
  client_address_city: string;
  client_address_postal_code: string;
  project_name: string;
  project_type: string;
  scope: string;
  budget: number;
  timeline: string;
  objectives: string[];
  constraints: string[];
  success_criteria: string[];
  company_name?: string;
  company_siret?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SupabaseEnrichedData {
  id: string;
  ccf_id: string;
  address_text: string;
  latitude?: number;
  longitude?: number;
  dpe_class?: string;
  dpe_consumption?: number;
  dpe_emissions?: number;
  cadastre_parcel_number?: string;
  cadastre_year_construction?: number;
  cadastre_building_type?: string;
  cadastre_total_surface?: number;
  regulatory_abf_zone: boolean;
  regulatory_floodable_zone: boolean;
  regulatory_seismic_zone?: string;
  embedding?: number[];
  enrichment_status: string;
  enriched_at?: string;
}

// ============================================================================
// CCF OPERATIONS
// ============================================================================

export async function createCCF(data: CCFData): Promise<SupabaseCCF | null> {
  try {
    const ccfData: Partial<SupabaseCCF> = {
      client_name: data.clientName,
      client_phone: data.clientPhone,
      client_email: data.clientEmail,
      client_address_number: data.projectAddress?.number,
      client_address_street: data.projectAddress?.street || '',
      client_address_city: data.projectAddress?.city || '',
      client_address_postal_code: data.projectAddress?.postalCode || '',
      project_name: data.projectName,
      project_type: data.projectType,
      scope: data.scope,
      budget: data.budget,
      timeline: data.timeline,
      objectives: data.objectives || [],
      constraints: data.constraints || [],
      success_criteria: data.successCriteria || [],
      company_name: data.company,
      company_siret: data.siret,
      status: 'draft',
    };

    const { data: created, error } = await supabase
      .from('ccf')
      .insert([ccfData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating CCF:', error);
      return null;
    }

    console.log('✅ CCF created in Supabase:', created);
    return created;
  } catch (error) {
    console.error('❌ CCF creation error:', error);
    return null;
  }
}

export async function getCCF(id: string): Promise<SupabaseCCF | null> {
  try {
    const { data, error } = await supabase
      .from('ccf')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching CCF:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ CCF fetch error:', error);
    return null;
  }
}

export async function updateCCF(id: string, updates: Partial<SupabaseCCF>): Promise<SupabaseCCF | null> {
  try {
    const { data, error } = await supabase
      .from('ccf')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating CCF:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ CCF update error:', error);
    return null;
  }
}

// ============================================================================
// ENRICHED DATA OPERATIONS
// ============================================================================

export async function storeEnrichedData(
  ccfId: string,
  enrichedData: EnrichedClientData
): Promise<SupabaseEnrichedData | null> {
  try {
    const storedData: Partial<SupabaseEnrichedData> = {
      ccf_id: ccfId,
      address_text: enrichedData.addressText,
      latitude: enrichedData.coordinates?.latitude,
      longitude: enrichedData.coordinates?.longitude,

      // DPE
      dpe_class: enrichedData.dpe?.class,
      dpe_consumption: enrichedData.dpe?.consumption,
      dpe_emissions: enrichedData.dpe?.emissions,

      // Cadastre
      cadastre_parcel_number: enrichedData.cadastre?.parcelleNumber,
      cadastre_year_construction: enrichedData.cadastre?.yearConstruction,
      cadastre_building_type: enrichedData.cadastre?.buildingType,
      cadastre_total_surface: enrichedData.cadastre?.totalSurface,

      // Réglementaire
      regulatory_abf_zone: enrichedData.regulatory?.abfZone || false,
      regulatory_floodable_zone: enrichedData.regulatory?.floodableZone || false,
      regulatory_seismic_zone: enrichedData.regulatory?.seismicZone,

      // Embedding
      embedding: enrichedData.embedding,

      // Status
      enrichment_status: enrichedData.enrichmentStatus,
      enriched_at: enrichedData.lastUpdated,
    };

    const { data, error } = await supabase
      .from('client_enriched_data')
      .insert([storedData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error storing enriched data:', error);
      return null;
    }

    console.log('✅ Enriched data stored:', data);
    return data;
  } catch (error) {
    console.error('❌ Enriched data store error:', error);
    return null;
  }
}

export async function getEnrichedData(ccfId: string): Promise<SupabaseEnrichedData | null> {
  try {
    const { data, error } = await supabase
      .from('client_enriched_data')
      .select('*')
      .eq('ccf_id', ccfId)
      .order('enriched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('❌ Error fetching enriched data:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Enriched data fetch error:', error);
    return null;
  }
}

// ============================================================================
// RAG SEARCH (Vector Similarity Search)
// ============================================================================

export async function searchEnrichedDataByEmbedding(
  embedding: number[],
  limit: number = 5,
  similarity_threshold: number = 0.7
): Promise<SupabaseEnrichedData[]> {
  try {
    const { data, error } = await supabase.rpc('match_enriched_data', {
      query_embedding: embedding,
      match_count: limit,
      match_threshold: similarity_threshold,
    });

    if (error) {
      console.error('❌ Error searching enriched data:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Enriched data search error:', error);
    return [];
  }
}

// ============================================================================
// QUOTE UPLOADS
// ============================================================================

export async function uploadQuotePDF(
  ccfId: string,
  file: File,
  uploadedBy: string
): Promise<string | null> {
  try {
    // Sanitize filename - remove special characters that Supabase Storage rejects
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .toLowerCase();

    // Upload fichier à Supabase Storage
    const filePath = `ccf/${ccfId}/${Date.now()}_${sanitizedName}`;

    console.log('🔄 [uploadQuotePDF] Uploading to storage:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('quote-uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ [uploadQuotePDF] Storage upload error:', uploadError);
      throw new Error(`Storage error: ${uploadError.message}`);
    }

    console.log('✅ [uploadQuotePDF] File uploaded to storage');

    // Créer enregistrement DB
    const { data: urlData } = supabase.storage
      .from('quote-uploads')
      .getPublicUrl(filePath);

    console.log('🔄 [uploadQuotePDF] Creating database record...');

    const { data: record, error: dbError } = await supabase
      .from('quote_uploads')
      .insert([
        {
          ccf_id: ccfId,
          filename: file.name,
          file_size: file.size,
          file_path: filePath,
          file_url: urlData?.publicUrl,
          uploaded_by: uploadedBy,
          processing_status: 'pending',
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('❌ [uploadQuotePDF] DB insert error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log('✅ [uploadQuotePDF] Quote uploaded successfully:', record.id);
    return record.id;
  } catch (error) {
    console.error('❌ [uploadQuotePDF] Upload error:', error);
    throw error; // Re-throw so caller can handle
  }
}

// ============================================================================
// ANALYSIS
// ============================================================================

export async function createAnalysis(
  ccfId: string,
  quoteUploadId: string,
  analysis: {
    conformity_score: number;
    overall_score: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    alerts: any[];
    recommendations: any[];
    abf_alert?: boolean;
    flood_alert?: boolean;
    seismic_alert?: boolean;
    budget_vs_market_ratio?: number;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('quote_analysis')
      .insert([
        {
          ccf_id: ccfId,
          quote_upload_id: quoteUploadId,
          conformity_score: analysis.conformity_score,
          overall_score: analysis.overall_score,
          status: analysis.status,
          alerts: analysis.alerts,
          recommendations: analysis.recommendations,
          abf_alert: analysis.abf_alert || false,
          flood_alert: analysis.flood_alert || false,
          seismic_alert: analysis.seismic_alert || false,
          budget_vs_market_ratio: analysis.budget_vs_market_ratio,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating analysis:', error);
      return null;
    }

    console.log('✅ Analysis created:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ Analysis creation error:', error);
    return null;
  }
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export async function logAction(
  ccfId: string,
  action: string,
  details?: any,
  status: 'success' | 'failed' | 'partial' = 'success',
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('audit_log').insert([
      {
        ccf_id: ccfId,
        action,
        details,
        status,
        error_message: errorMessage,
      },
    ]);
  } catch (error) {
    console.error('❌ Audit log error:', error);
  }
}

// ============================================================================
// MIGRATION: localStorage → Supabase
// ============================================================================

export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    // Récupérer données localStorage
    const ccfJson = localStorage.getItem('currentCCF');
    const enrichedJson = localStorage.getItem('enrichedClientData');

    if (!ccfJson) {
      console.warn('⚠️ No CCF data in localStorage');
      return false;
    }

    const ccfData = JSON.parse(ccfJson) as CCFData & { enrichedData?: EnrichedClientData };
    const enrichedData = ccfData.enrichedData || (enrichedJson ? JSON.parse(enrichedJson) : null);

    console.log('📤 Migrating from localStorage...');

    // Créer CCF dans Supabase
    const createdCCF = await createCCF(ccfData);
    if (!createdCCF) throw new Error('Failed to create CCF');

    // Stocker données enrichies si disponibles
    if (enrichedData) {
      await storeEnrichedData(createdCCF.id, enrichedData);
    }

    // Log action
    await logAction(createdCCF.id, 'migration_from_localstorage', {
      has_enrichment: !!enrichedData,
    });

    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration error:', error);
    return false;
  }
}

export default supabase;
