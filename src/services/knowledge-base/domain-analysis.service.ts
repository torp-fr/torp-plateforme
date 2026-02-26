/**
 * Domain Analysis Service
 * Analyzes proposals using domain knowledge base
 * Identifies gaps, issues, recommendations, and optimizations
 */

import { ragOrchestratorService } from './rag-orchestrator.service';
import { log, warn, error, time, timeEnd } from '@/lib/logger';
import type {
  DomainAnalysisRequest,
  DomainAnalysisResult,
  DomainIssue,
  DomainRecommendation,
  DomainOptimization,
  KnowledgeQuery,
  KnowledgeResult,
  DocumentCategory,
} from './types';

export class DomainAnalysisService {
  /**
   * Analyze a devis proposal against domain knowledge
   */
  async analyzeProposal(request: DomainAnalysisRequest): Promise<DomainAnalysisResult> {
    const startTime = Date.now();

    log(`[Domain Analysis] Starting analysis for: ${request.proposalData.type}`);

    // Phase 1: Query knowledge base for relevant information
    const knowledgeSources = await this.queryKnowledgeBase(request);

    // Phase 2: Identify issues/gaps
    const issues = await this.identifyIssues(request, knowledgeSources);

    // Phase 3: Generate recommendations
    const recommendations = await this.generateRecommendations(request, knowledgeSources, issues);

    // Phase 4: Suggest optimizations
    const optimizations = await this.suggestOptimizations(request, knowledgeSources);

    // Phase 5: Web enrichment (if requested)
    let webEnrichment: any = undefined;
    if (request.includeWebSearch) {
      webEnrichment = await this.enrichWithWebSearch(request, knowledgeSources);
    }

    // Phase 6: Generate synthesis
    const executiveSummary = this.generateExecutiveSummary(issues, recommendations, optimizations);
    const detailedAnalysis = this.generateDetailedAnalysis(
      request,
      knowledgeSources,
      issues,
      recommendations,
      optimizations
    );

    const analysisDate = new Date();
    const analysisDurationMs = Date.now() - startTime;

    log(`[Domain Analysis] Completed in ${analysisDurationMs}ms`);
    log(`[Domain Analysis] Found ${issues.length} issues, ${recommendations.length} recommendations`);

    return {
      issues,
      recommendations,
      optimizations,
      knowledgeSources,
      webEnrichment,
      executiveSummary,
      detailedAnalysis,
      analysisDate,
      confidence: this.calculateConfidence(knowledgeSources),
      analysisDurationMs,
    };
  }

  /**
   * Query knowledge base for relevant information
   */
  private async queryKnowledgeBase(request: DomainAnalysisRequest): Promise<any[]> {
    const queries: KnowledgeQuery[] = [];

    // Query 1: Work type best practices
    queries.push({
      query: `Best practices for ${request.proposalData.type} work`,
      context: request.proposalData.description,
      categories: ['DTU' as DocumentCategory, 'GUIDELINE' as DocumentCategory, 'BEST_PRACTICE' as DocumentCategory],
      maxResults: 5,
      includeRelated: true,
    });

    // Query 2: Regulatory requirements
    queries.push({
      query: `Regulatory requirements and norms for ${request.proposalData.type}`,
      categories: ['NORM' as DocumentCategory, 'REGULATION' as DocumentCategory, 'EUROCODE' as DocumentCategory],
      maxResults: 5,
    });

    // Query 3: Materials and specifications
    if (request.proposalData.materials?.length) {
      queries.push({
        query: `Specifications for ${request.proposalData.materials.join(', ')}`,
        categories: ['TECHNICAL_GUIDE' as DocumentCategory, 'MANUAL' as DocumentCategory],
        maxResults: 5,
      });
    }

    // Query 4: Quality standards
    queries.push({
      query: `Quality standards and guarantees for ${request.proposalData.type}`,
      categories: ['WARRANTY' as DocumentCategory, 'LIABILITY' as DocumentCategory],
      maxResults: 3,
    });

    // Query 5: Sustainability considerations
    queries.push({
      query: `Sustainability and energy efficiency for ${request.proposalData.type}`,
      categories: ['SUSTAINABILITY' as DocumentCategory, 'ENERGY_EFFICIENCY' as DocumentCategory],
      maxResults: 3,
    });

    // Execute all queries in parallel
    const results = await Promise.all(queries.map(q => ragOrchestratorService.executeQuery(q)));

    return results.flatMap(r => r.documents);
  }

  /**
   * Identify gaps and issues
   */
  private async identifyIssues(
    request: DomainAnalysisRequest,
    knowledgeSources: any[]
  ): Promise<DomainIssue[]> {
    const issues: DomainIssue[] = [];

    // Check 1: Missing compliance documentation
    const hasRegulatoryDocs = knowledgeSources.some(
      doc => doc.category === 'REGULATION' || doc.category === 'NORM'
    );

    if (!hasRegulatoryDocs && request.proposalData.type) {
      issues.push({
        id: 'compliance_missing',
        title: 'Missing regulatory references',
        description:
          'The proposal does not reference applicable regulations and norms for this type of work',
        severity: 'major',
        category: 'non-compliant',
        impact: 'Legal and insurance risks',
        affectedAreas: ['Regulatory compliance', 'Insurance coverage'],
        suggestedFix: 'Add explicit references to applicable DTU, Eurocode, and building regulations',
      });
    }

    // Check 2: Missing quality specifications
    if (!request.proposalData.description || request.proposalData.description.length < 100) {
      issues.push({
        id: 'specs_incomplete',
        title: 'Insufficient detail in specifications',
        description: 'The proposal lacks detailed technical specifications',
        severity: 'major',
        category: 'suboptimal',
        impact: 'Ambiguity in project scope, potential disputes',
        affectedAreas: ['Quality assurance', 'Project scope'],
        suggestedFix: 'Add detailed specifications including materials, dimensions, finishes, and quality standards',
      });
    }

    // Check 3: Missing timeline/planning
    if (!request.demandData?.timeline || request.demandData.timeline === 'undefined') {
      issues.push({
        id: 'planning_missing',
        title: 'No detailed project timeline',
        description: 'The proposal lacks a detailed schedule with milestones',
        severity: 'minor',
        category: 'suboptimal',
        impact: 'Difficulty in project coordination',
        affectedAreas: ['Project management', 'Timeline'],
        suggestedFix: 'Request a detailed Gantt chart or timeline with major milestones',
      });
    }

    // Check 4: Missing warranty/guarantee information
    if (!request.proposalData.description?.includes('garantie') && !request.proposalData.description?.includes('warranty')) {
      issues.push({
        id: 'warranty_missing',
        title: 'No warranty information provided',
        description: 'The proposal does not specify warranty coverage and duration',
        severity: 'major',
        category: 'missing',
        impact: 'No recourse if defects appear after completion',
        affectedAreas: ['Customer protection', 'Legal coverage'],
        suggestedFix: 'Request 10-year decennial guarantee (garantie décennale)',
        knowledgeReference: knowledgeSources.find(doc => doc.category === 'WARRANTY'),
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on knowledge
   */
  private async generateRecommendations(
    request: DomainAnalysisRequest,
    knowledgeSources: any[],
    issues: DomainIssue[]
  ): Promise<DomainRecommendation[]> {
    const recommendations: DomainRecommendation[] = [];

    // Recommendation 1: Best practices alignment
    const bestPracticeDocs = knowledgeSources.filter(doc => doc.category === 'BEST_PRACTICE');
    if (bestPracticeDocs.length > 0) {
      recommendations.push({
        id: 'apply_best_practices',
        title: 'Align with industry best practices',
        description: 'Ensure proposal follows established best practices for this work type',
        priority: 'high',
        category: 'quality',
        rationale: 'Industry best practices ensure optimal outcomes and reduce risks',
        implementationSteps: [
          'Review applicable best practice documents',
          'Compare proposal against standard practices',
          'Request adjustments where deviations are not justified',
        ],
        baselineReference: bestPracticeDocs[0],
        expectedBenefits: ['Improved quality', 'Reduced risk of issues', 'Better longevity'],
      });
    }

    // Recommendation 2: Regulatory compliance
    const regulatoryDocs = knowledgeSources.filter(doc => doc.category === 'REGULATION' || doc.category === 'NORM');
    if (regulatoryDocs.length > 0 && issues.some(i => i.category === 'non-compliant')) {
      recommendations.push({
        id: 'ensure_compliance',
        title: 'Ensure full regulatory compliance',
        description: 'Verify that all aspects comply with applicable regulations',
        priority: 'high',
        category: 'compliance',
        rationale: 'Non-compliance can lead to rejection, fines, or need to redo work',
        implementationSteps: [
          'Obtain and review applicable regulatory documents',
          'Request compliance certification from contractor',
          'Arrange pre-work inspection',
        ],
        estimatedEffort: '5-10 hours',
        expectedBenefits: ['Legal compliance', 'Insurance coverage', 'Avoids future issues'],
      });
    }

    // Recommendation 3: Quality documentation
    recommendations.push({
      id: 'quality_documentation',
      title: 'Request detailed quality documentation',
      description: 'Ensure contractor provides detailed specifications and quality standards',
      priority: 'medium',
      category: 'quality',
      rationale: 'Detailed documentation prevents misunderstandings and disputes',
      implementationSteps: ['Request material datasheets', 'Require performance specifications', 'Define acceptance criteria'],
      expectedBenefits: ['Clear expectations', 'Objective acceptance criteria'],
    });

    // Recommendation 4: Sustainability/Efficiency (if applicable)
    const sustainabilityDocs = knowledgeSources.filter(doc => doc.category === 'SUSTAINABILITY');
    if (sustainabilityDocs.length > 0) {
      recommendations.push({
        id: 'sustainability_optimization',
        title: 'Optimize for sustainability',
        description: 'Consider eco-friendly options that may improve long-term value',
        priority: 'medium',
        category: 'sustainability',
        rationale: 'Sustainable solutions often provide better ROI and environmental benefits',
        implementationSteps: ['Review sustainable alternatives', 'Calculate lifecycle costs', 'Assess energy savings'],
        estimatedCost: { min: 0, max: 5000, unit: 'EUR' },
        expectedBenefits: [
          'Lower operating costs',
          'Environmental benefits',
          'Potential subsidies (MaPrimeRénov)',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Suggest optimizations
   */
  private async suggestOptimizations(
    request: DomainAnalysisRequest,
    knowledgeSources: any[]
  ): Promise<DomainOptimization[]> {
    const optimizations: DomainOptimization[] = [];

    // Optimization 1: Budget optimization
    if (request.proposalData.budget && request.demandData?.budget) {
      if (request.proposalData.budget > request.demandData.budget * 1.1) {
        optimizations.push({
          id: 'cost_reduction',
          title: 'Cost optimization opportunities',
          description: 'Explore ways to achieve objectives with lower cost',
          type: 'cost',
          potentialGain: `Up to 10% savings`,
          currentState: `Budget: ${request.proposalData.budget}€`,
          proposedState: `Optimized to ~${Math.round(request.demandData.budget * 1.05)}€`,
          implementationPath: 'Negotiate on non-critical features, explore alternative materials',
          complexity: 'moderate',
          riskLevel: 'low',
        });
      }
    }

    // Optimization 2: Timeline optimization
    optimizations.push({
      id: 'timeline_optimization',
      title: 'Timeline efficiency',
      description: 'Optimize project schedule for efficiency',
      type: 'timeline',
      potentialGain: 'Shorter duration reduces labor costs',
      currentState: 'Standard sequential approach',
      proposedState: 'Optimized parallel workflows',
      implementationPath: 'Request detailed timeline analysis from contractor',
      complexity: 'simple',
      riskLevel: 'low',
    });

    // Optimization 3: Quality gains
    optimizations.push({
      id: 'quality_gains',
      title: 'Quality improvement opportunities',
      description: 'Small investments that significantly improve long-term satisfaction',
      type: 'quality',
      potentialGain: 'Better durability and warranty',
      currentState: 'Standard quality level',
      proposedState: 'Premium quality with better guarantees',
      implementationPath: 'Upgrade specific materials or add quality assurance processes',
      complexity: 'simple',
      roiEstimate: 'High - avoids future expensive repairs',
      riskLevel: 'low',
    });

    return optimizations;
  }

  /**
   * Enrich with web search (if requested)
   */
  private async enrichWithWebSearch(request: DomainAnalysisRequest, knowledgeSources: any[]): Promise<any> {
    // TODO: Implement web search enrichment
    // Would search for: DTU updates, regulatory changes, market prices, new materials
    return {
      sources: [],
      insights: [],
    };
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    issues: DomainIssue[],
    recommendations: DomainRecommendation[],
    optimizations: DomainOptimization[]
  ): string {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const majorCount = issues.filter(i => i.severity === 'major').length;

    return `
**Analysis Summary:**

- **Issues Found:** ${issues.length} (${criticalCount} critical, ${majorCount} major)
- **Recommendations:** ${recommendations.length}
- **Optimization Opportunities:** ${optimizations.length}

**Key Findings:**
${issues
  .filter(i => i.severity === 'critical' || i.severity === 'major')
  .slice(0, 3)
  .map(i => `- **[${i.severity.toUpperCase()}]** ${i.title}`)
  .join('\n')}

**Recommended Actions:**
${recommendations
  .filter(r => r.priority === 'high')
  .slice(0, 3)
  .map(r => `- ${r.title}: ${r.rationale}`)
  .join('\n')}
    `.trim();
  }

  /**
   * Generate detailed analysis
   */
  private generateDetailedAnalysis(
    request: DomainAnalysisRequest,
    knowledgeSources: any[],
    issues: DomainIssue[],
    recommendations: DomainRecommendation[],
    optimizations: DomainOptimization[]
  ): string {
    return `
## Detailed Domain Analysis for ${request.proposalData.type}

### Proposal Overview
- **Type:** ${request.proposalData.type}
- **Budget:** ${request.proposalData.budget || 'Not specified'}€
- **Timeline:** ${request.demandData?.timeline || 'Not specified'}

### Knowledge Base References
Used ${knowledgeSources.length} authoritative sources for analysis

### Issues & Gaps
${issues.map(i => `- **${i.title}** (${i.severity}): ${i.description}`).join('\n')}

### Recommendations
${recommendations.map(r => `- **${r.title}** (${r.priority}): ${r.description}`).join('\n')}

### Optimization Opportunities
${optimizations.map(o => `- **${o.title}**: ${o.description} (${o.potentialGain})`).join('\n')}
    `.trim();
  }

  /**
   * Calculate overall confidence in analysis
   */
  private calculateConfidence(knowledgeSources: any[]): number {
    if (knowledgeSources.length === 0) return 30;
    if (knowledgeSources.length < 3) return 50;
    if (knowledgeSources.length < 6) return 70;
    return 85;
  }
}

export const domainAnalysisService = new DomainAnalysisService();
