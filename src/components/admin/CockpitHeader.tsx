import React from 'react';
import { Sparkles, Activity, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function CockpitHeader() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-30 backdrop-blur-sm bg-background/80 border-b border-border/50">
      <div className="flex items-center justify-between px-6 py-3 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">TORP Control Center</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Activity className="h-3 w-3 mr-1" />
              Engines Active
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Zap className="h-3 w-3 mr-1" />
              APIs Online
            </Badge>
          </div>

          <Button
            onClick={() => navigate('/analyze')}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            Créer analyse
          </Button>
        </div>
      </div>
    </div>
  );
}
