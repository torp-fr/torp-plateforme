/**
 * LLM Analytics Service
 * Fetches usage data from the llm_usage_log table and analytical views
 */

import { supabase } from '@/lib/supabase';

export interface DailyUsage {
  date: string;
  total_requests: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  avg_latency_ms: number;
  max_request_cost: number;
  min_request_cost: number;
}

export interface UserUsage {
  user_id: string;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  first_usage: string;
  last_usage: string;
}

export interface ModelUsage {
  model: string;
  total_requests: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  avg_latency_ms: number;
  avg_cost_per_request: number;
}

export interface ActionUsage {
  action: string;
  total_requests: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  avg_latency_ms: number;
  avg_cost_per_request: number;
}

export interface UsageStats {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  today_cost: number;
  today_requests: number;
  this_month_cost: number;
  this_month_requests: number;
  average_latency_ms: number;
}

class LLMAnalyticsService {
  /**
   * Fetch daily usage statistics
   */
  async getDailyUsage(days: number = 30): Promise<DailyUsage[]> {
    try {
      const { data, error } = await supabase
        .from('daily_llm_costs')
        .select('*')
        .order('date', { ascending: false })
        .limit(days);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching daily usage:', err);
      return [];
    }
  }

  /**
   * Fetch top users by cost
   */
  async getTopUsers(limit: number = 10): Promise<UserUsage[]> {
    try {
      const { data, error } = await supabase
        .from('user_llm_usage')
        .select('*')
        .order('total_cost', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching top users:', err);
      return [];
    }
  }

  /**
   * Fetch model usage breakdown
   */
  async getModelUsage(): Promise<ModelUsage[]> {
    try {
      const { data, error } = await supabase
        .from('model_llm_costs')
        .select('*')
        .order('total_cost', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching model usage:', err);
      return [];
    }
  }

  /**
   * Fetch action usage breakdown
   */
  async getActionUsage(): Promise<ActionUsage[]> {
    try {
      const { data, error } = await supabase
        .from('action_llm_costs')
        .select('*')
        .order('total_cost', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching action usage:', err);
      return [];
    }
  }

  /**
   * Fetch overall statistics
   */
  async getOverallStats(): Promise<UsageStats | null> {
    try {
      // Get total stats
      const { data: allData, error: allError } = await supabase
        .from('llm_usage_log')
        .select('total_tokens, cost_estimate, latency_ms')
        .eq('error', false);

      if (allError) throw allError;

      // Get today's stats
      const today = new Date().toISOString().split('T')[0];
      const { data: todayData, error: todayError } = await supabase
        .from('llm_usage_log')
        .select('cost_estimate')
        .gte('timestamp', `${today}T00:00:00`)
        .eq('error', false);

      if (todayError) throw todayError;

      // Get this month's stats
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const { data: monthData, error: monthError } = await supabase
        .from('llm_usage_log')
        .select('cost_estimate')
        .gte('timestamp', `${firstDay}T00:00:00`)
        .eq('error', false);

      if (monthError) throw monthError;

      const totalTokens = allData?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0;
      const totalCost = allData?.reduce((sum, row) => sum + (row.cost_estimate || 0), 0) || 0;
      const avgLatency =
        allData && allData.length > 0
          ? allData.reduce((sum, row) => sum + (row.latency_ms || 0), 0) / allData.length
          : 0;
      const todayCost = todayData?.reduce((sum, row) => sum + (row.cost_estimate || 0), 0) || 0;
      const thisMonthCost =
        monthData?.reduce((sum, row) => sum + (row.cost_estimate || 0), 0) || 0;

      return {
        total_requests: allData?.length || 0,
        total_tokens: totalTokens,
        total_cost: totalCost,
        today_cost: todayCost,
        today_requests: todayData?.length || 0,
        this_month_cost: thisMonthCost,
        this_month_requests: monthData?.length || 0,
        average_latency_ms: Math.round(avgLatency)
      };
    } catch (err) {
      console.error('Error fetching overall stats:', err);
      return null;
    }
  }

  /**
   * Fetch recent usage entries (for debugging)
   */
  async getRecentUsage(limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('llm_usage_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching recent usage:', err);
      return [];
    }
  }
}

export const llmAnalyticsService = new LLMAnalyticsService();
