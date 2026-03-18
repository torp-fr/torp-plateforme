/**
 * Legal Obligations Extraction Prompt
 * Balanced approach: legal requirements + important legal implications
 * Includes interpretations and regulatory intent
 */

export const legalObligationsPrompt = (chunkContent) => `You are a legal compliance analyst extracting obligations and legal implications.

EXTRACTION CRITERIA:
- Mandatory requirements (must, shall, required)
- Prohibited actions (shall not, must not, forbidden)
- Important legal implications and regulatory intent
- Conditional obligations (if X happens, then Y is required)
- Exception handling and special cases

DOCUMENT CONTENT:
${chunkContent}

EXTRACTION FORMAT:
Return a JSON array with this exact structure:
[
  {
    "id": "unique-id",
    "type": "exigence|interdiction",
    "title": "Obligation title",
    "description": "Full legal requirement or prohibition",
    "legal_reference": "Article X, Section Y, Paragraph Z",
    "applicable_phase": "conception|execution|controle",
    "sanction_risk": "faible|moyen|eleve",
    "conditional": false,
    "conditions": "Condition text if applicable",
    "extracted_from_text": "Exact quote from document"
  }
]

Extract all legal obligations with their regulatory context. Return [] if none found.`;

export default legalObligationsPrompt;
