import React from 'react';
import { Database, Zap, Plug, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';

interface ActionItem {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  color: string;
}

const QUICK_ACTIONS: ActionItem[] = [
  {
    id: 'kb-upload',
    icon: Database,
    label: 'Upload Knowledge',
    description: 'Add documents to KB',
    href: '/analytics/knowledge',
    color: 'from-amber-500/10 to-amber-600/5',
  },
  {
    id: 'orchestration',
    icon: Zap,
    label: 'Launch Orchestration',
    description: 'Run analysis engine',
    href: '/analytics/orchestrations',
    color: 'from-blue-500/10 to-blue-600/5',
  },
  {
    id: 'check-apis',
    icon: Plug,
    label: 'Check APIs',
    description: 'System health status',
    href: '/analytics/system',
    color: 'from-purple-500/10 to-purple-600/5',
  },
  {
    id: 'logs',
    icon: FileText,
    label: 'View Logs',
    description: 'System activity log',
    href: '/analytics/security',
    color: 'from-green-500/10 to-green-600/5',
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Card
            key={action.id}
            onClick={() => navigate(action.href)}
            className={`p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 bg-gradient-to-br ${action.color}`}
          >
            <div className="flex flex-col gap-3">
              <div className="h-10 w-10 rounded-lg bg-background/40 flex items-center justify-center">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
