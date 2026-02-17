/**
 * Job Status Page - Real-time job monitoring
 * Displays analysis job progress, status, and results
 * Phase 32.1: Async Orchestration & Job Queue Architecture
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Home,
  RefreshCw,
  Download,
} from 'lucide-react';
import { jobService } from '@/core/jobs/job.service';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisJob } from '@/core/jobs/job.service';

const STATUS_LABELS = {
  pending: 'En attente',
  processing: 'En cours de traitement',
  completed: 'Terminé',
  failed: 'Erreur',
  cancelled: 'Annulé',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
  cancelled: AlertCircle,
};

export default function JobStatusPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch job status
  const fetchJobStatus = React.useCallback(async () => {
    if (!jobId) return;

    try {
      const fetchedJob = await jobService.getJobById(jobId);
      if (!fetchedJob) {
        setError('Job not found');
        setJob(null);
      } else {
        setJob(fetchedJob);
        setError(null);

        // Stop auto-refresh when job is completed or failed
        if (fetchedJob.status === 'completed' || fetchedJob.status === 'failed') {
          setAutoRefresh(false);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch job status';
      setError(message);
      console.error('Error fetching job status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  // Initial fetch
  useEffect(() => {
    fetchJobStatus();
  }, [fetchJobStatus]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchJobStatus();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchJobStatus]);

  const handleViewResults = () => {
    if (job?.devis_id) {
      navigate(`/results?devisId=${job.devis_id}`);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;

    try {
      await jobService.cancelJob(jobId);
      toast({
        title: 'Job cancelled',
        description: 'The analysis job has been cancelled.',
      });
      setJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to cancel job',
        variant: 'destructive',
      });
    }
  };

  const handleRetry = () => {
    setAutoRefresh(true);
    setIsLoading(true);
    fetchJobStatus();
  };

  if (isLoading && !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading job status...</p>
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/')}>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
              <Button onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) return null;

  const StatusIcon = STATUS_ICONS[job.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analysis Status</h1>
        <p className="text-muted-foreground">Monitor your devis analysis progress</p>
      </div>

      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                {STATUS_LABELS[job.status as keyof typeof STATUS_LABELS]}
              </CardTitle>
              <CardDescription>
                Job ID: {jobId?.substring(0, 8)}...
              </CardDescription>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                STATUS_COLORS[job.status as keyof typeof STATUS_COLORS]
              }`}
            >
              {job.status.toUpperCase()}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="h-2" />
          </div>

          {/* Timeline */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(job.created_at).toLocaleString()}</span>
            </div>
            {job.started_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Started</span>
                <span>{new Date(job.started_at).toLocaleString()}</span>
              </div>
            )}
            {job.completed_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{new Date(job.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {job.error_message && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{job.error_message}</AlertDescription>
            </Alert>
          )}

          {/* Status-specific Messages */}
          {job.status === 'processing' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Your analysis is being processed. This may take a few minutes.</AlertDescription>
            </Alert>
          )}

          {job.status === 'completed' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Analysis completed successfully! You can now view the results.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {job.status === 'processing' && (
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        )}

        {job.status === 'completed' && (
          <Button onClick={handleViewResults} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            View Results
          </Button>
        )}

        {job.status === 'failed' && (
          <Button onClick={handleRetry} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => navigate('/dashboard')}
          className="flex-1 sm:flex-none"
        >
          <Home className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
      </div>

      {/* Auto-refresh Status */}
      {autoRefresh && job.status === 'processing' && (
        <p className="text-xs text-muted-foreground text-center">
          ⟳ Refreshing every 3 seconds...
        </p>
      )}
    </div>
  );
}
