/**
 * API Calls Timeline - Visual representation of external API calls
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ApiCall {
  callOrder?: number;
  service: string;
  endpoint?: string;
  calledAt: Date | string;
  responseTimeMs?: number;
  statusCode?: number;
  errorOccurred: boolean;
  errorMessage?: string;
}

interface ApiCallsTimelineProps {
  calls: ApiCall[];
  totalDurationMs?: number;
}

const SERVICE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  pappers: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🏢' },
  insee: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '📊' },
  rge: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅' },
  google_maps: { bg: 'bg-red-100', text: 'text-red-800', icon: '🗺️' },
  other: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '🔗' },
};

const getServiceColor = (service: string) => {
  return SERVICE_COLORS[service.toLowerCase()] || SERVICE_COLORS.other;
};

const getStatusIcon = (errorOccurred: boolean, statusCode?: number) => {
  if (errorOccurred) return <AlertCircle className="h-5 w-5 text-red-500" />;
  if (statusCode && statusCode >= 200 && statusCode < 300) {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
  return <Clock className="h-5 w-5 text-gray-500" />;
};

const formatTime = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getResponseTimeStyle = (responseTimeMs?: number, totalDurationMs?: number) => {
  if (!responseTimeMs) return {};
  const percentage = totalDurationMs ? (responseTimeMs / totalDurationMs) * 100 : responseTimeMs / 1000;
  return { width: `${Math.min(percentage, 100)}%` };
};

export function ApiCallsTimeline({ calls, totalDurationMs }: ApiCallsTimelineProps) {
  const sortedCalls = [...calls].sort((a, b) => {
    const dateA = new Date(a.calledAt).getTime();
    const dateB = new Date(b.calledAt).getTime();
    return dateA - dateB;
  });

  const totalTime = sortedCalls.reduce((sum, c) => sum + (c.responseTimeMs || 0), 0);
  const successCount = sortedCalls.filter(c => !c.errorOccurred).length;
  const errorCount = sortedCalls.filter(c => c.errorOccurred).length;

  if (sortedCalls.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Timeline des appels API</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Aucun appel API enregistré
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="space-y-4">
          <CardTitle className="text-foreground">Timeline des appels API</CardTitle>

          {/* Statistics */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Appels totaux: </span>
              <span className="font-semibold text-foreground">{sortedCalls.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Succès: </span>
              <span className="font-semibold text-green-600">{successCount}</span>
            </div>
            {errorCount > 0 && (
              <div>
                <span className="text-muted-foreground">Erreurs: </span>
                <span className="font-semibold text-red-600">{errorCount}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Durée totale: </span>
              <span className="font-semibold text-foreground">
                {totalTime > 1000 ? `${(totalTime / 1000).toFixed(1)}s` : `${totalTime}ms`}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Timeline */}
        <div className="space-y-3">
          {sortedCalls.map((call, idx) => {
            const color = getServiceColor(call.service);
            const hasError = call.errorOccurred;

            return (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="group cursor-pointer space-y-1 p-3 rounded-lg border border-border hover:bg-accent transition">
                      {/* Call Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {/* Status Icon */}
                          <div>
                            {getStatusIcon(hasError, call.statusCode)}
                          </div>

                          {/* Service Badge */}
                          <Badge className={`${color.bg} ${color.text}`}>
                            {color.icon} {call.service.toUpperCase()}
                          </Badge>

                          {/* Time */}
                          <span className="text-xs text-muted-foreground">
                            {formatTime(call.calledAt)}
                          </span>

                          {/* Response Time */}
                          {call.responseTimeMs && (
                            <span className="text-xs font-mono text-foreground">
                              {call.responseTimeMs}ms
                            </span>
                          )}

                          {/* Status Code */}
                          {call.statusCode && !hasError && (
                            <span className="text-xs text-green-600 font-mono">
                              {call.statusCode}
                            </span>
                          )}

                          {hasError && call.statusCode && (
                            <span className="text-xs text-red-600 font-mono">
                              {call.statusCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Response Time Bar */}
                      {call.responseTimeMs && (
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 group-hover:opacity-75 transition"
                            style={getResponseTimeStyle(call.responseTimeMs, totalDurationMs)}
                          />
                        </div>
                      )}

                      {/* Error Message */}
                      {hasError && call.errorMessage && (
                        <p className="text-xs text-red-600">{call.errorMessage}</p>
                      )}

                      {/* Endpoint */}
                      {call.endpoint && (
                        <p className="text-xs text-muted-foreground truncate">
                          {call.endpoint}
                        </p>
                      )}
                    </div>
                  </TooltipTrigger>

                  <TooltipContent className="max-w-sm">
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Service:</strong> {call.service}
                      </p>
                      {call.endpoint && (
                        <p>
                          <strong>Endpoint:</strong> {call.endpoint}
                        </p>
                      )}
                      <p>
                        <strong>Heure:</strong> {formatTime(call.calledAt)}
                      </p>
                      <p>
                        <strong>Durée:</strong>{' '}
                        {call.responseTimeMs
                          ? call.responseTimeMs > 1000
                            ? `${(call.responseTimeMs / 1000).toFixed(1)}s`
                            : `${call.responseTimeMs}ms`
                          : 'N/A'}
                      </p>
                      {call.statusCode && (
                        <p>
                          <strong>Status:</strong> {call.statusCode}
                        </p>
                      )}
                      {call.errorMessage && (
                        <p>
                          <strong>Erreur:</strong> {call.errorMessage}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export type { ApiCall };
