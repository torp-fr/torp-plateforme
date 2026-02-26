/**
 * PHASE 36: Knowledge Governance Service
 * Manages quality scoring, versioning, usage tracking, and impact measurement
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface KnowledgeQualityMetrics {
  quality_score: number;
  usage_count: number;
  impact_score: number;
  is_low_quality: boolean;
  last_used_at?: string;
  version_number: number;
}

class KnowledgeGovernanceService {
  /**
   * Record document usage in analysis
   */
  async recordUsage(
    document_id: string,
    analysis_id: string,
    devis_id: string,
    impact_score: number = 1,
    options?: {
      category_used?: string;
      region_matched?: string;
    }
  ): Promise<boolean> {
    try {
      log('[GOVERNANCE] 📊 Recording usage:', { document_id, impact_score });

      const { error: insertError } = await supabase.from('knowledge_usage_metrics').insert({
        document_id,
        analysis_id,
        devis_id,
        impact_score: Math.min(100, Math.max(0, impact_score)),
        category_used: options?.category_used,
        region_matched: options?.region_matched,
      });

      if (insertError) {
        console.error('[GOVERNANCE] ❌ Failed to record usage:', insertError);
        return false;
      }

      // Update document usage count asynchronously
      this.updateUsageCount(document_id);

      log('[GOVERNANCE] ✅ Usage recorded');
      return true;
    } catch (error) {
      console.error('[GOVERNANCE] 💥 Recording error:', error);
      return false; // Don't fail analysis
    }
  }

  /**
   * Update usage count and quality score
   */
  private async updateUsageCount(document_id: string): Promise<void> {
    try {
      await supabase.rpc('update_knowledge_usage_count', {
        p_document_id: document_id,
      });
      log('[GOVERNANCE] ✅ Usage count updated');
    } catch (error) {
      warn('[GOVERNANCE] ⚠️ Could not update usage count:', error);
      // Don't crash
    }
  }

  /**
   * Calculate quality score based on multiple factors
   */
  async calculateQualityScore(document_id: string): Promise<number> {
    try {
      log('[GOVERNANCE] 🧮 Calculating quality score...');

      // Fetch document metrics
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('id', document_id)
        .single();

      if (fetchError || !doc) {
        warn('[GOVERNANCE] Could not fetch document');
        return 50;
      }

      // Calculate components
      const reliabilityScore = doc.reliability_score || 50; // 0-100
      const recencyDays = Math.floor((Date.now() - new Date(doc.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      const recencyScore = Math.max(0, 100 - recencyDays); // Decrease with age

      const usageScore = Math.min(100, (doc.usage_count || 0) * 10); // 10 points per use, max 100

      // Authority based on source
      const authorityScores: Record<string, number> = {
        'INSEE': 95,
        'ADEME': 90,
        'DTU': 90,
        'EUROCODE': 85,
        'REGULATION': 85,
        'NORM': 80,
        'GUIDELINE': 75,
        'BEST_PRACTICE': 70,
        'TECHNICAL_GUIDE': 70,
        'CASE_STUDY': 60,
        'TRAINING': 55,
        'MANUAL': 50,
        'USER_FEEDBACK': 40,
      };
      const authorityScore = authorityScores[doc.source] || 50;

      // Weighted calculation
      const quality =
        authorityScore * 0.3 + // 30% authority
        reliabilityScore * 0.2 + // 20% reliability
        recencyScore * 0.2 + // 20% recency
        usageScore * 0.2 + // 20% usage
        (doc.feedback_score || 50) * 0.1; // 10% feedback

      const finalScore = Math.round(Math.max(0, Math.min(100, quality)));

      log('[GOVERNANCE] ✅ Quality score calculated:', finalScore);
      return finalScore;
    } catch (error) {
      console.error('[GOVERNANCE] 💥 Quality calculation error:', error);
      return 50;
    }
  }

  /**
   * Detect and flag low quality documents
   */
  async detectLowQualityDocuments(): Promise<Array<{ document_id: string; reason: string }>> {
    try {
      log('[GOVERNANCE] 🔍 Detecting low quality documents...');

      const { data: issues, error } = await supabase.rpc('detect_low_quality_documents');

      if (error) {
        console.error('[GOVERNANCE] ❌ Detection error:', error);
        return [];
      }

      if (issues && issues.length > 0) {
        log('[GOVERNANCE] ⚠️ Found', issues.length, 'potential low quality documents');

        // Flag them
        for (const issue of issues) {
          await supabase
            .from('knowledge_documents')
            .update({ is_low_quality: true })
            .eq('id', issue.document_id);
        }
      }

      return issues || [];
    } catch (error) {
      console.error('[GOVERNANCE] 💥 Detection error:', error);
      return [];
    }
  }

  /**
   * Create new version of document (supersede old version)
   */
  async createNewVersion(
    old_document_id: string,
    new_content: string,
    new_source: string,
    new_reliability: number
  ): Promise<string | null> {
    try {
      log('[GOVERNANCE] 📝 Creating new document version...');

      // Get old document info
      const { data: oldDoc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('id', old_document_id)
        .single();

      if (fetchError || !oldDoc) {
        console.error('[GOVERNANCE] Could not fetch old document');
        return null;
      }

      // Create new document
      const { data: newDoc, error: insertError } = await supabase
        .from('knowledge_documents')
        .insert({
          source: new_source || oldDoc.source,
          category: oldDoc.category,
          region: oldDoc.region,
          content: new_content,
          reliability_score: new_reliability || oldDoc.reliability_score,
          metadata: oldDoc.metadata,
          version_number: (oldDoc.version_number || 1) + 1,
          parent_document_id: old_document_id,
        })
        .select()
        .single();

      if (insertError || !newDoc) {
        console.error('[GOVERNANCE] Failed to create new version');
        return null;
      }

      // Supersede old document
      await supabase
        .from('knowledge_documents')
        .update({ is_superseded: true })
        .eq('id', old_document_id);

      log('[GOVERNANCE] ✅ New version created:', newDoc.id);
      return newDoc.id;
    } catch (error) {
      console.error('[GOVERNANCE] 💥 Versioning error:', error);
      return null;
    }
  }

  /**
   * Get knowledge impact summary for analytics
   */
  async getImpactSummary(): Promise<{
    total_active: number;
    avg_quality: number;
    most_used: Array<{ id: string; source: string; usage_count: number }>;
    low_quality_count: number;
  } | null> {
    try {
      log('[GOVERNANCE] 📊 Fetching impact summary...');

      // Get total active documents
      const { count: totalActive } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get average quality
      const { data: qualityData } = await supabase
        .from('knowledge_documents')
        .select('quality_score')
        .eq('is_active', true);

      const avgQuality =
        qualityData && qualityData.length > 0
          ? Math.round(qualityData.reduce((sum, doc) => sum + (doc.quality_score || 50), 0) / qualityData.length)
          : 50;

      // Get most used
      const { data: mostUsed } = await supabase
        .from('knowledge_documents')
        .select('id, source, usage_count')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(5);

      // Get low quality count
      const { count: lowQualityCount } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_low_quality', true);

      log('[GOVERNANCE] ✅ Impact summary fetched');
      return {
        total_active: totalActive || 0,
        avg_quality: avgQuality,
        most_used: mostUsed || [],
        low_quality_count: lowQualityCount || 0,
      };
    } catch (error) {
      console.error('[GOVERNANCE] 💥 Summary fetch error:', error);
      return null;
    }
  }
}

export const knowledgeGovernanceService = new KnowledgeGovernanceService();
