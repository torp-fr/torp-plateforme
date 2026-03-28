/**
 * Supabase Write Guards
 * Enforces architectural rules about which services can write to which tables
 */

/**
 * Assert that no writes are attempted to knowledge_documents table
 * Only the test script (testFullIngestion.ts) may create documents
 *
 * @param tableName - The table name being accessed
 * @throws Error if attempting to write to knowledge_documents
 */
export function assertNoKnowledgeDocumentWrites(tableName: string): void {
  if (tableName === 'knowledge_documents') {
    throw new Error(
      'Forbidden write: ingestion services may not modify knowledge_documents. ' +
      'Only test scripts are allowed to create documents via testFullIngestion.ts'
    );
  }
}

/**
 * Validates that an operation is read-only
 * @param operation - The operation type (select, insert, update, delete)
 * @param tableName - The table being accessed
 * @throws Error if operation is a write on protected tables
 */
export function assertReadOnlyOperation(
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert',
  tableName: string
): void {
  if (operation !== 'select' && tableName === 'knowledge_documents') {
    assertNoKnowledgeDocumentWrites(tableName);
  }
}
