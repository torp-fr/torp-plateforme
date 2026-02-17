/**
 * Knowledge Base Page - Content management
 * Phase 32.2: Real data when available
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export function KnowledgeBasePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Knowledge Base</h1>
        <p className="text-muted-foreground">Manage documentation and learning materials</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Knowledge Base Content
          </CardTitle>
          <CardDescription>Documentation and articles</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No articles yet"
            description="Knowledge base articles will appear here as they are created"
            icon={<BookOpen className="h-12 w-12 text-muted-foreground/50" />}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default KnowledgeBasePage;
