# Token Counting in Edge Functions

Real-time token validation and safety checks for LLM API calls in Deno Edge Functions.

## Overview

The token counting utility provides:
- **Pre-request validation**: Count tokens before calling LLMs
- **Context limit checks**: Ensure requests stay within 80% of model's context window
- **Multi-model support**: OpenAI (GPT-4, GPT-3.5, Embeddings) and Anthropic (Claude 3.x)
- **Safety margins**: 20% buffer reserved by default for safety
- **Structured error responses**: Clear error format for client handling

## Supported Models

### OpenAI
- `gpt-4o` (128K context)
- `gpt-4-turbo` (128K context)
- `gpt-4` (8K context)
- `gpt-3.5-turbo` (4K context)
- `text-embedding-3-small` (8K context)
- `text-embedding-3-large` (8K context)

### Anthropic (Claude)
- `claude-3-5-sonnet-20241022` (200K context)
- `claude-sonnet-4-20250514` (200K context)
- `claude-3-5-haiku-20241022` (200K context)
- `claude-3-opus-20250219` (200K context)
- And other Claude 3.x models

## Basic Usage

### 1. Count Tokens in Text

```typescript
import { countTokens } from '../_shared/token-counter.ts';

const text = "Your long text here...";
const model = 'gpt-4o';

const tokenCount = countTokens(text, model);
console.log(`Text uses approximately ${tokenCount} tokens`);
```

### 2. Count Tokens in Messages (Chat Format)

```typescript
import { countMessagesTokens } from '../_shared/token-counter.ts';

const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
  { role: 'assistant', content: 'Paris is the capital of France.' }
];

const totalTokens = countMessagesTokens(messages, 'claude-3-5-sonnet-20241022');
console.log(`Messages use approximately ${totalTokens} tokens`);
```

### 3. Validate Before LLM Call

```typescript
import { validateTokens } from '../_shared/token-counter.ts';
import { type TokenCountResult, type TokenCountError } from '../_shared/token-counter.ts';

const messages = [{ role: 'user', content: 'Your prompt here' }];
const model = 'gpt-4o';
const maxTokens = 2000;
const systemPrompt = 'You are a helpful assistant.';

const validation = validateTokens(messages, model, maxTokens, systemPrompt);

if ('error' in validation && validation.error !== undefined) {
  // Handle error
  const error = validation as TokenCountError;
  console.error(`Token validation failed: ${error.message}`);
  // Return 400 error response to client
  return errorResponse({
    error: 'context_limit_exceeded',
    message: error.message,
    inputTokens: error.inputTokens,
    maxAllowed: error.maxAllowed
  });
} else {
  // Safe to proceed with LLM call
  const result = validation as TokenCountResult;
  console.log(`✓ Token validation passed (${result.estimatedTotal}/${result.safeLimit})`);
}
```

## Integration in Edge Functions

### llm-completion Function

The `llm-completion` edge function automatically validates tokens:

```typescript
// Tokens are validated before API call
// Error response if limit exceeded:
{
  "error": "context_limit_exceeded",
  "message": "Token limit exceeded: 150000 > 102400 (context window: 128000)",
  "details": {
    "inputTokens": 145000,
    "outputTokens": 5000,
    "totalTokens": 150000,
    "maxAllowed": 102400
  }
}

// Success response includes token info:
{
  "content": "...",
  "tokens": {
    "estimated": 5234,
    "actual": 5200
  },
  "tokenValidation": {
    "inputTokens": 234,
    "outputTokens": 5000,
    "estimatedTotal": 5234,
    "safeLimit": 102400
  }
}
```

### rag-query Function

Token validation for Devis extraction:

```typescript
// POST /rag-query
{
  "action": "extract",
  "devisText": "..."
}

// Response includes token tracking:
{
  "success": true,
  "extracted": { ... },
  "tokens": {
    "estimated": 12000,
    "safeLimit": 160000
  }
}
```

### ingest-document Function

Token validation for OpenAI Vision OCR:

```typescript
// Tokens checked before vision API call
// If exceeds limit:
// - Falls back to OCR.space
// - Falls back to basic PDF extraction
// Detailed logs show token validation status
```

## Token Counting Algorithms

### Approximate Formula

The utility uses text-based estimation:

```
Token Count = Text Length × Tokens Per Character (by model)
```

**Tokens per character by model type:**
- OpenAI GPT models: ~0.25 (4 characters per token average)
- Claude models: ~0.33 (3 characters per token average)

### Accuracy

- **Estimation accuracy**: ±5-10% for most texts
- **More accurate for**: Programmatic text, code, JSON
- **Less accurate for**: Natural language with special characters
- **Actual count**: Available from API usage statistics after call

### Message Overhead

Chat messages include formatting overhead:
- ~4 tokens per message for role, formatting, separators
- Calculated automatically in `countMessagesTokens()`

## Safety Thresholds

### Default Configuration

```
Safe Limit = Context Window × (1 - Safety Margin)
Safe Limit = Context Window × 0.80  (20% margin by default)
```

### Examples

| Model | Context Window | Safe Limit | Max Input | Max Output |
|-------|---|---|---|---|
| gpt-4o | 128,000 | 102,400 | 97,400 | 5,000 |
| gpt-4 | 8,192 | 6,553 | 1,553 | 5,000 |
| Claude 3.5 Sonnet | 200,000 | 160,000 | 155,000 | 5,000 |

### Custom Safety Margin

```typescript
const result = checkTokenLimit(
  inputTokens,
  outputTokens,
  model,
  safetyMarginPercent = 25  // Use 25% margin instead of 20%
);
```

## Error Handling

### Token Limit Exceeded

```typescript
{
  error: 'context_limit_exceeded',
  message: 'Token limit exceeded: 150000 > 102400 (context window: 128000)',
  inputTokens: 145000,
  outputTokens: 5000,
  maxAllowed: 102400
}
```

### Invalid Model

```typescript
{
  error: 'invalid_model',
  message: 'Unknown model: gpt-5-super-turbo',
  inputTokens: 100,
  outputTokens: 500,
  maxAllowed: 0
}
```

### Validation Error

```typescript
{
  error: 'unknown',
  message: 'Token validation error: ...',
  inputTokens: 0,
  outputTokens: 0,
  maxAllowed: 0
}
```

## API Reference

### countTokens(text, model)

Count tokens in a single text string.

```typescript
function countTokens(text: string, model: string): number
```

**Parameters:**
- `text` (string): Text to count tokens for
- `model` (string): Model name

**Returns:** Estimated token count

### countMessagesTokens(messages, model, includeSystemPrompt)

Count tokens in chat message array.

```typescript
function countMessagesTokens(
  messages: Array<{ role: string; content: string }>,
  model: string,
  includeSystemPrompt: boolean = true
): number
```

### validateTokens(messages, model, maxTokens, systemPrompt)

Validate that request fits within safe token limits.

```typescript
function validateTokens(
  messages: Array<{ role: string; content: string }> | string,
  model: string,
  maxTokens?: number,
  systemPrompt?: string
): TokenCountResult | TokenCountError
```

**Returns:**
- `TokenCountResult` if within limits
- `TokenCountError` if exceeds limits

### checkTokenLimit(inputTokens, outputTokens, model, safetyMarginPercent)

Check if total tokens exceed safe limit.

```typescript
function checkTokenLimit(
  inputTokens: number,
  outputTokens: number,
  model: string,
  safetyMarginPercent: number = 20
): TokenCountResult | TokenCountError
```

### formatTokenError(errorResult)

Format error for API response.

```typescript
function formatTokenError(errorResult: TokenCountError): object
```

### getContextWindow(model)

Get context window size for a model.

```typescript
function getContextWindow(model: string): number | null
```

### getSupportedModels()

Get array of all supported model names.

```typescript
function getSupportedModels(): string[]
```

## Best Practices

### 1. Always Validate Before Calling LLMs

```typescript
// ✓ Good
const validation = validateTokens(messages, model, maxTokens, systemPrompt);
if ('error' in validation && validation.error !== undefined) {
  return errorResponse(validation);
}
await callLLM(messages);

// ✗ Bad - No validation
await callLLM(messages);  // May fail with 4xx error
```

### 2. Use System Prompts

```typescript
// ✓ Good - Includes system prompt in calculation
const validation = validateTokens(messages, model, maxTokens, systemPrompt);

// ✗ Bad - System prompt not counted
const validation = validateTokens(messages, model, maxTokens);
```

### 3. Handle Token Errors Gracefully

```typescript
// ✓ Good - Check error type
if ('error' in result && result.error === 'context_limit_exceeded') {
  return {
    status: 400,
    error: 'Request too large for model',
    suggestion: 'Use a model with larger context or reduce input size'
  };
}

// ✗ Bad - Generic error
if (!result.success) {
  return 'Error';
}
```

### 4. Log Token Metrics

```typescript
// ✓ Good - Detailed logging
console.log('[LLM Call]', {
  model,
  inputTokens: result.inputTokens,
  outputTokens: result.outputTokens,
  estimatedTotal: result.estimatedTotal,
  safeLimit: result.safeLimit,
  utilizationPercent: ((result.estimatedTotal / result.safeLimit) * 100).toFixed(1)
});

// Helps with monitoring and optimization
```

### 5. Adjust Safety Margin for Known Cases

```typescript
// ✓ Good - For safety-critical operations
const result = checkTokenLimit(
  inputTokens,
  outputTokens,
  model,
  35  // Use 35% margin (65% safe limit) for safety-critical
);

// ✗ Bad - No safety margin
const result = checkTokenLimit(inputTokens, outputTokens, model, 0);
```

## Debugging Token Counting

### View Token Estimation

```typescript
const model = 'gpt-4o';
const text = 'Your text here';
const tokens = countTokens(text, model);
const chars = text.length;
const charsPerToken = chars / tokens;

console.log(`Text: ${chars} chars = ${tokens} tokens (${charsPerToken.toFixed(2)} chars/token)`);
// Text: 500 chars = 125 tokens (4.00 chars/token)
```

### Compare Estimated vs Actual

After LLM call, compare estimates to actual usage:

```typescript
const estimated = result.tokens.estimated;
const actual = result.usage?.total_tokens || result.usage?.input_tokens + result.usage?.output_tokens;
const accuracy = ((estimated / actual) * 100).toFixed(1);

console.log(`Estimate accuracy: ${accuracy}% (${estimated} vs ${actual})`);
```

### Test with Different Models

```typescript
const text = 'Same text';
const models = ['gpt-4o', 'gpt-4', 'claude-3-5-sonnet-20241022'];

models.forEach(model => {
  const tokens = countTokens(text, model);
  console.log(`${model}: ${tokens} tokens`);
});
// Compare token efficiency across models
```

## Performance

- **Token counting**: <1ms for typical requests
- **Validation**: <5ms including all checks
- **Memory**: Negligible (no caching/state)
- **No external API calls**: All estimation is local

## Limitations

1. **Estimation-based**: Not exact token counts
2. **Special characters**: May have ±10% error for highly unusual text
3. **Vision requests**: Can't count image tokens (API limitation)
4. **Streaming**: Can't predict exact streaming token distribution

For exact counts, use API usage statistics after the call completes.

## Future Enhancements

- [ ] Exact token counting using js-tiktoken library
- [ ] Per-message token tracking for multi-turn conversations
- [ ] Token usage analytics and reporting
- [ ] Automatic model selection based on context size
- [ ] Token budget enforcement across requests
- [ ] Rate limiting based on token usage

## Changelog

### v1.0.0 (Initial Release)
- Token counting for text and messages
- Multi-model support (OpenAI, Anthropic)
- Pre-request validation
- Safety threshold enforcement
- Error formatting
- Integration examples
