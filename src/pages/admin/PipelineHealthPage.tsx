/**
 * PipelineHealthPage — Tab 11: Pipeline operational health dashboard.
 * - Dead-letter queue (DLQ) management
 * - Certification score distribution (A–E grade chart)
 * - Company learning status (confidence levels)
 * Auto-refreshes every 30s.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  AlertOctagon, GraduationCap, Brain, RefreshCw, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// ── Types ────────────────────────────────────────────────────────────────────

interface DLQItem {
  id: string;
  pipeline_name: string;
  job_id: string;
  failure_reason: string;
  attempt_count: number;
  created_at: string;
}

interface CertificationData {
  total: number;
  distribution: Record<string, number>;
  avg_score: number;
  recent: Array<{ siret: string; grade: string; total_score: number; computed_at: string }>;
}

interface LearningData {
  total_companies: number;
  avg_confidence: number;
  fully_learned: number;
  companies: Array<{
    siret: string;
    raison_sociale: string;
    devis_count: number;
    learning_confidence: number;
  }>;
}

// ── Grade color map ───────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#6366f1',
  C: '#f59e0b',
  D: '#f97316',
  E: '#ef4444',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function PipelineHealthPage() {
  const [dlq, setDlq]       = useState<DLQItem[]>([]);
  const [cert, setCert]     = useState<CertificationData | null>(null);
  const [learning, setLearning] = useState<LearningData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [dlqRes, certRes, learningRes] = await Promise.allSettled([
        fetch('/api/v1/admin/dlq', { headers }),
        fetch('/api/v1/admin/pipeline/certification', { headers }),
        fetch('/api/v1/admin/pipeline/learning', { headers }),
      ]);

      if (dlqRes.status === 'fulfilled' && dlqRes.value.ok) {
        const json = await dlqRes.value.json();
        setDlq(json.items ?? []);
      }
      if (certRes.status === 'fulfilled' && certRes.value.ok) {
        setCert(await certRes.value.json());
      }
      if (learningRes.status === 'fulfilled' && learningRes.value.ok) {
        setLearning(await learningRes.value.json());
      }

      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const id = setInterval(() => void fetchData(), 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleRetryDLQ = async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/v1/admin/dlq/${requestId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        toast({ title: 'Réessai lancé', description: `Job ${requestId} remis en file` });
        await fetchData();
      } else {
        toast({ title: 'Erreur', description: 'Impossible de relancer le job', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const gradeData = ['A', 'B', 'C', 'D', 'E'].map(grade => ({
    grade,
    count: cert?.distribution[grade] ?? 0,
    fill: GRADE_COLORS[grade],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertOctagon className="h-8 w-8 text-primary" />
            Santé du Pipeline
          </h1>
          <p className="text-muted-foreground">
            DLQ, scores de certification, apprentissage entreprises
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              {lastRefresh.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={dlq.length > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertOctagon className={`h-8 w-8 ${dlq.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm text-muted-foreground">Jobs en DLQ</p>
                <p className={`text-2xl font-bold ${dlq.length > 0 ? 'text-red-600' : ''}`}>{dlq.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Score moyen</p>
                <p className="text-2xl font-bold">{cert?.avg_score ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Entreprises apprenantes</p>
                <p className="text-2xl font-bold">{learning?.total_companies ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {learning?.fully_learned ?? 0} matures (conf. = 1.0)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DLQ Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-red-500" />
              Dead Letter Queue ({dlq.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dlq.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground">Aucun job en attente — pipeline sain</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {dlq.map(item => (
                  <div key={item.id} className="flex items-start justify-between p-3 rounded-lg border bg-red-50/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{item.pipeline_name}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.attempt_count} tentative(s)
                        </span>
                      </div>
                      <p className="text-xs text-red-700 mt-1 truncate">{item.failure_reason}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2 flex-shrink-0"
                      onClick={() => void handleRetryDLQ(item.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Réessayer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certification Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Certification — Distribution des grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cert && cert.total > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={gradeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="grade" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {gradeData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {cert.total} devis scorés — score moyen : {cert.avg_score}/100
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-10">
                Aucun score de certification disponible
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Learning Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Apprentissage Entreprises
            {learning && (
              <Badge variant="outline" className="ml-auto">
                Confiance moy. : {Math.round((learning.avg_confidence ?? 0) * 100)}%
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!learning || learning.companies.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun profil d'entreprise enregistré
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Entreprise</th>
                    <th className="text-left py-2 font-medium">SIRET</th>
                    <th className="text-right py-2 font-medium">Devis</th>
                    <th className="text-left py-2 font-medium">Confiance</th>
                  </tr>
                </thead>
                <tbody>
                  {learning.companies.slice(0, 20).map(company => (
                    <tr key={company.siret} className="border-b last:border-0">
                      <td className="py-2.5 font-medium truncate max-w-[180px]">
                        {company.raison_sociale || '—'}
                      </td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">
                        {company.siret}
                      </td>
                      <td className="py-2.5 text-right">{company.devis_count}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-purple-500"
                              style={{ width: `${company.learning_confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">
                            {Math.round(company.learning_confidence * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
