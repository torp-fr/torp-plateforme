/**
 * Strict Obligations Extraction Prompt
 * Focuses on mandatory requirements and legal obligations only
 * No interpretations, no best practices, only hard requirements
 */

export const strictObligationsPrompt = (chunkContent) => `You are a regulatory compliance specialist extracting ONLY strict legal obligations.

CRITICAL RULES:
- Extract ONLY mandatory requirements (must, shall, required)
- Ignore recommendations, best practices, suggestions
- Ignore conditional statements ("may", "should", "could")
- One obligation per regulatory reference
- Include exact legal text where available

DOCUMENT CONTENT:
${chunkContent}

EXTRACTION FORMAT:
Return a JSON array with this exact structure:
[
  {
    "id": "unique-id",
    "type": "exigence",
    "title": "Brief obligation title",
    "description": "Full requirement text",
    "legal_reference": "Article X, Section Y or null",
    "applicable_phase": "conception|execution|controle",
    "sanction_risk": "faible|moyen|eleve",
    "extracted_from_text": "Exact quote from document"
  }
]

Extract ONLY strict obligations. Return empty array [] if no strict obligations found.`;

export default strictObligationsPrompt;
