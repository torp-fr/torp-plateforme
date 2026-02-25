import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Engine {
  id: string;
  label: string;
  status: 'active' | 'idle' | 'error';
  color: string;
  dotColor: string;
}

const ENGINES: Engine[] = [
  {
    id: 'context',
    label: 'Context',
    status: 'active',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'lot',
    label: 'Lot',
    status: 'active',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'rule',
    label: 'Rule',
    status: 'active',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    dotColor: 'bg-purple-500',
  },
  {
    id: 'scoring',
    label: 'Scoring',
    status: 'active',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    dotColor: 'bg-orange-500',
  },
  {
    id: 'enrichment',
    label: 'Enrichment',
    status: 'idle',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    dotColor: 'bg-gray-400',
  },
  {
    id: 'audit',
    label: 'Audit',
    status: 'idle',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    dotColor: 'bg-gray-400',
  },
  {
    id: 'vision',
    label: 'Vision',
    status: 'active',
    color: 'bg-pink-100 text-pink-700 border-pink-300',
    dotColor: 'bg-pink-500',
  },
];

export function EngineStatusStrip() {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-muted-foreground mb-3">ORCHESTRATION PIPELINE</div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {ENGINES.map((engine) => (
          <div key={engine.id} className="flex items-center gap-1.5 whitespace-nowrap">
            <div className={`h-2 w-2 rounded-full ${engine.dotColor} animate-pulse`} />
            <Badge
              variant="outline"
              className={engine.color}
            >
              {engine.label}
            </Badge>
            {ENGINES.indexOf(engine) < ENGINES.length - 1 && (
              <div className="text-muted-foreground/30 text-xs">→</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
