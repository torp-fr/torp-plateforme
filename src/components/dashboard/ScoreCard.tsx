/**
 * ScoreCard — Post-audit results display
 * Shows A–E grade, overall score, and 4-metric breakdown
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Share2, Archive, ChevronRight, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';

export interface AuditMetrics {
  compliance: number;    // 0–100
  completeness: number;  // 0–100
  clarity: number;       // 0–100
  pricing: number;       // 0–100
}

export interface AuditResult {
  score: number;         // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  metrics: AuditMetrics;
  criticalIssues: number;
  minorIssues: number;
  recommendations: number;
  analyzedAt?: string;
}

interface ScoreCardProps {
  result: AuditResult;
  projectName?: string;
  onViewDetails?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onArchive?: () => void;
}

const GRADE_CONFIG = {
  A: { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: '#10B981' },
  B: { label: 'Bon', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', ring: '#0EA5E9' },
  C: { label: 'Correct', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', ring: '#F59E0B' },
  D: { label: 'Insuffisant', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', ring: '#F97316' },
  E: { label: 'Critique', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', ring: '#EF4444' },
};

const METRIC_BARS = [
  { key: 'compliance' as const, label: 'Conformité', color: 'bg-sky-500' },
  { key: 'completeness' as const, label: 'Complétude', color: 'bg-emerald-500' },
  { key: 'clarity' as const, label: 'Clarté', color: 'bg-sky-400' },
  { key: 'pricing' as const, label: 'Compétitivité prix', color: 'bg-emerald-400' },
];

export function ScoreCard({ result, projectName, onViewDetails, onExport, onShare, onArchive }: ScoreCardProps) {
  const grade = GRADE_CONFIG[result.grade];

  return (
    <div className="space-y-6">
      {/* Hero score */}
      <Card className={`border ${grade.border}`}>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Circle score */}
            <div className="relative flex-shrink-0">
              <svg width="140" height="140" className="-rotate-90">
                <circle cx="70" cy="70" r="58" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                <circle
                  cx="70" cy="70" r="58"
                  fill="none"
                  stroke={grade.ring}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - result.score / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-foreground font-display">{result.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>

            {/* Grade + status */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-3">
                <span className={`text-5xl font-bold font-display ${grade.color}`}>{result.grade}</span>
                <div>
                  <Badge className={`${grade.bg} ${grade.color} border ${grade.border} text-sm px-3`}>
                    {grade.label}
                  </Badge>
                  {projectName && (
                    <p className="text-sm text-muted-foreground mt-1">{projectName}</p>
                  )}
                </div>
              </div>

              {/* 4 metrics */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {METRIC_BARS.map(m => (
                  <div key={m.key}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{m.label}</span>
                      <span className="font-medium text-foreground">{result.metrics[m.key]}/100</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full ${m.color} rounded-full transition-all duration-500`}
                        style={{ width: `${result.metrics[m.key]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Conformité */}
        <Card className="border-border hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conformité</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{result.metrics.compliance}%</p>
            <p className="text-xs text-sky-600 mt-1">En bonne voie</p>
          </CardContent>
        </Card>

        {/* Risques */}
        <Card className="border-border hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Évaluation des risques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 mt-0.5">
              {result.criticalIssues > 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span className="text-sm font-semibold text-foreground">
                {result.criticalIssues === 0 ? 'Risque faible' : `${result.criticalIssues} critique(s)`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {result.criticalIssues} critique · {result.minorIssues} mineur(s)
            </p>
          </CardContent>
        </Card>

        {/* Recommandations */}
        <Card className="border-border hover:shadow-md transition-shadow cursor-pointer group" onClick={onViewDetails}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recommandations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-2xl font-bold text-foreground">{result.recommendations}</p>
            </div>
            <button className="text-xs text-sky-600 mt-1 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
              Voir le détail <ChevronRight className="h-3 w-3" />
            </button>
          </CardContent>
        </Card>

        {/* Prochaines étapes */}
        <Card className="border-border hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prochaines étapes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs justify-start gap-1.5"
              onClick={onExport}
            >
              <Download className="h-3 w-3" /> Exporter PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs justify-start gap-1.5"
              onClick={onShare}
            >
              <Share2 className="h-3 w-3" /> Partager
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs justify-start gap-1.5 text-muted-foreground"
              onClick={onArchive}
            >
              <Archive className="h-3 w-3" /> Archiver
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ScoreCard;
