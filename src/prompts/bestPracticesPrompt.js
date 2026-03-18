/**
 * Best Practices Extraction Prompt
 * Focuses on recommendations, guidelines, and best practices
 * Includes quality standards and optimization opportunities
 */

export const bestPracticesPrompt = (chunkContent) => `You are a construction quality specialist extracting best practices and recommendations.

EXTRACTION CRITERIA:
- Recommendations (should, recommended, best practice)
- Quality standards and benchmarks
- Optimization opportunities
- Risk mitigation strategies
- Efficiency improvements
- Cost-effectiveness considerations

DOCUMENT CONTENT:
${chunkContent}

EXTRACTION FORMAT:
Return a JSON array with this exact structure:
[
  {
    "id": "unique-id",
    "type": "recommandation",
    "title": "Practice or recommendation title",
    "description": "Detailed description of best practice",
    "category": "quality|efficiency|cost|risk|sustainability",
    "applicable_phase": "conception|execution|controle",
    "impact_level": "faible|moyen|eleve",
    "implementation_effort": "faible|moyen|eleve",
    "extracted_from_text": "Exact quote from document"
  }
]

Extract all best practices and recommendations. Return [] if none found.`;

export default bestPracticesPrompt;
