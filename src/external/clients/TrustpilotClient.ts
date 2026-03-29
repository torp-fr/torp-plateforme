import { BaseAPIClient } from './BaseAPIClient.js';
import type { APICallResult, TrustpilotBusinessData } from '../types/index.js';

interface TrustpilotSearchResponse {
  results?: Array<{ id: string; displayName: string; score?: { trustScore: number }; numberOfReviews?: { total: number } }>;
}

interface TrustpilotReviewsResponse {
  reviews?: Array<{ stars: number; text?: string; createdAt: string }>;
}

export class TrustpilotClient extends BaseAPIClient {
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: process.env['TRUSTPILOT_API_ENDPOINT'] ?? 'https://api.trustpilot.com/v1',
      timeout: 10000,
      retries: 2,
      backoffMs: 1000,
    });
  }

  async searchBusinessByName(companyName: string): Promise<APICallResult<TrustpilotBusinessData>> {
    if (!this.config.apiKey) {
      return { success: false, error: 'TRUSTPILOT_API_KEY not configured' };
    }

    // Step 1: Find business unit
    const searchResult = await this.callAPI<TrustpilotSearchResponse>('GET', '/business-units/search', {
      query: { query: companyName, country: 'FR' },
      cacheKey:        `tp:search:${companyName.toLowerCase().replace(/\s+/g, '_')}`,
      cacheTTLSeconds: 86400 * 30,
    });

    if (!searchResult.success || !searchResult.data?.results?.length) {
      return { success: false, error: 'Business not found on Trustpilot' };
    }

    const biz = searchResult.data.results[0];

    // Step 2: Fetch reviews
    const reviewsResult = await this.callAPI<TrustpilotReviewsResponse>('GET',
      `/business-units/${biz.id}/reviews`, {
        query: { language: 'fr', limit: 10 },
        cacheKey:        `tp:reviews:${biz.id}`,
        cacheTTLSeconds: 86400 * 7,
      });

    const reviews = (reviewsResult.data?.reviews ?? []).map(r => ({
      rating:     r.stars,
      text:       r.text ?? '',
      created_at: r.createdAt,
    }));

    const avgRating = biz.score?.trustScore
      ?? (reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0);

    return {
      success: true,
      executionTimeMs: (searchResult.executionTimeMs ?? 0) + (reviewsResult.executionTimeMs ?? 0),
      data: {
        name:          biz.displayName,
        rating:        Math.round(avgRating * 100) / 100,
        reviews_count: biz.numberOfReviews?.total ?? reviews.length,
        reviews,
      },
    };
  }
}
