import React from 'react';
import { BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function KnowledgeBrainWidget() {
  const navigate = useNavigate();

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Cerveau Métier</h3>
            <p className="text-xs text-muted-foreground">Documents d'enrichissement RAG</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/analytics/knowledge')}
        >
          Gérer
        </Button>
      </div>
    </Card>
  );
}
