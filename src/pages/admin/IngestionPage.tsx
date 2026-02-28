/**
 * Ingestion Jobs Admin Page
 * Phase 42: Centralized admin control for document ingestion pipeline
 * List, monitor, and manage all ingestion jobs
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  Loader,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Play,
  Pause,
  RefreshCw,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { log, warn, error } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

interface IngestionJob {
  id: string;
  file_path: string;
  file_size_bytes: number;
  status: 'uploaded' | 'analyzed' | 'extracting' | 'chunking' | 'embedding' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  created_at: string;
  analyzed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  error_message: string | null;
  analysis_results: Record<string, any> | null;
}

// ============================================================
// STATUS STYLING
// ============================================================

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  uploaded: { color: 'bg-blue-100 text-blue-700', label: 'Uploadé', icon: <FileText className="h-4 w-4" /> },
  analyzed: { color: 'bg-purple-100 text-purple-700', label: 'Analysé', icon: <Zap className="h-4 w-4" /> },
  extracting: { color: 'bg-yellow-100 text-yellow-700', label: 'Extraction', icon: <Loader className="h-4 w-4 animate-spin" /> },
  chunking: { color: 'bg-yellow-100 text-yellow-700', label: 'Chunking', icon: <Loader className="h-4 w-4 animate-spin" /> },
  embedding: { color: 'bg-yellow-100 text-yellow-700', label: 'Embedding', icon: <Loader className="h-4 w-4 animate-spin" /> },
  completed: { color: 'bg-green-100 text-green-700', label: 'Complété', icon: <CheckCircle className="h-4 w-4" /> },
  failed: { color: 'bg-red-100 text-red-700', label: 'Erreur', icon: <AlertCircle className="h-4 w-4" /> },
  cancelled: { color: 'bg-gray-100 text-gray-700', label: 'Annulé', icon: <Pause className="h-4 w-4" /> },
};

const ACTIONABLE_STATUSES = ['uploaded', 'analyzed'];
const FINAL_STATUSES = ['completed', 'failed', 'cancelled'];

// ============================================================
// COMPONENT
// ============================================================

export function IngestionPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningJobId, setActioningJobId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
    // Poll every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchJobs() {
    try {
      const { data, error: err } = await supabase
        .from('ingestion_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;

      setJobs(data || []);
      setError(null);
      log('[INGESTION] Jobs loaded:', data?.length || 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load jobs';
      console.error('[INGESTION] Load error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze(jobId: string) {
    try {
      setActioningJobId(jobId);
      log('[INGESTION] Calling analyze-document for job:', jobId);

      const { data, error: err } = await supabase.functions.invoke('analyze-document', {
        body: { job_id: jobId },
      });

      if (err) throw err;

      log('[INGESTION] ✅ Analyze complete:', data);
      await fetchJobs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      console.error('[INGESTION] Analyze error:', msg);
      setError(msg);
    } finally {
      setActioningJobId(null);
    }
  }

  async function handleLaunchIngestion(jobId: string) {
    try {
      setActioningJobId(jobId);
      log('[INGESTION] Calling launch-ingestion for job:', jobId);

      const { data, error: err } = await supabase.functions.invoke('launch-ingestion', {
        body: { job_id: jobId },
      });

      if (err) throw err;

      log('[INGESTION] ✅ Launch ingestion complete:', data);
      await fetchJobs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Launch failed';
      console.error('[INGESTION] Launch error:', msg);
      setError(msg);
    } finally {
      setActioningJobId(null);
    }
  }

  async function handleCancel(jobId: string) {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce job?')) return;

    try {
      setActioningJobId(jobId);
      log('[INGESTION] Calling cancel-ingestion for job:', jobId);

      const { data, error: err } = await supabase.functions.invoke('cancel-ingestion', {
        body: { job_id: jobId },
      });

      if (err) throw err;

      log('[INGESTION] ✅ Cancel complete:', data);
      await fetchJobs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cancel failed';
      console.error('[INGESTION] Cancel error:', msg);
      setError(msg);
    } finally {
      setActioningJobId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }

  const extractFileName = (filePath: string): string => {
    const parts = filePath.split('/');
    const lastPart = parts[parts.length - 1];
    // Remove timestamp prefix (timestamp-filename)
    return lastPart.replace(/^\d+-/, '');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('fr-FR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline d'Ingestion</h1>
          <p className="text-sm text-muted-foreground">Gestion centralisée des jobs d'analyse documentaire</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">En cours</div>
            <div className="text-2xl font-bold text-yellow-600">
              {jobs.filter(j => !FINAL_STATUSES.includes(j.status)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Complétés</div>
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Erreurs</div>
            <div className="text-2xl font-bold text-red-600">
              {jobs.filter(j => j.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs d'Ingestion</CardTitle>
          <CardDescription>Cliquez sur les boutons d'action pour gérer les jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Chargement...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun job d'ingestion</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Fichier</th>
                    <th className="text-left py-3 px-4 font-semibold">Taille</th>
                    <th className="text-left py-3 px-4 font-semibold">Statut</th>
                    <th className="text-left py-3 px-4 font-semibold">Progrès</th>
                    <th className="text-left py-3 px-4 font-semibold">Créé</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const statusConfig = STATUS_CONFIG[job.status];
                    const canAnalyze = job.status === 'uploaded';
                    const canLaunch = job.status === 'analyzed';
                    const canCancel = ACTIONABLE_STATUSES.includes(job.status) || !FINAL_STATUSES.includes(job.status);
                    const isFinal = FINAL_STATUSES.includes(job.status);

                    return (
                      <tr key={job.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate max-w-xs" title={extractFileName(job.file_path)}>
                              {extractFileName(job.file_path)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-muted-foreground">
                          {formatFileSize(job.file_size_bytes)}
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={`gap-2 ${statusConfig.color}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{job.progress}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-muted-foreground text-xs">
                          {formatDate(job.created_at)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {canAnalyze && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAnalyze(job.id)}
                                disabled={actioningJobId === job.id}
                                className="gap-1"
                              >
                                {actioningJobId === job.id ? (
                                  <Loader className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Zap className="h-3 w-3" />
                                )}
                                Analyser
                              </Button>
                            )}

                            {canLaunch && (
                              <Button
                                size="sm"
                                onClick={() => handleLaunchIngestion(job.id)}
                                disabled={actioningJobId === job.id}
                                className="gap-1 bg-green-600 hover:bg-green-700"
                              >
                                {actioningJobId === job.id ? (
                                  <Loader className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                Lancer
                              </Button>
                            )}

                            {canCancel && !isFinal && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancel(job.id)}
                                disabled={actioningJobId === job.id}
                                className="gap-1"
                              >
                                {actioningJobId === job.id ? (
                                  <Loader className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Pause className="h-3 w-3" />
                                )}
                                Annuler
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Error messages */}
          {jobs.some(j => j.error_message) && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-4">Messages d'erreur</h3>
              <div className="space-y-2">
                {jobs
                  .filter(j => j.error_message)
                  .map(j => (
                    <div
                      key={j.id}
                      className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
                    >
                      <div className="font-medium text-xs text-red-600 mb-1">
                        {extractFileName(j.file_path)}
                      </div>
                      {j.error_message}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default IngestionPage;
