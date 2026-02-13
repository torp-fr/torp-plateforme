/**
 * Analytics Overview Cards - Summary statistics
 * Displays key metrics for a CCF analysis
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Zap, AlertCircle } from 'lucide-react';

interface AnalyticsOverviewCardsProps {
  totalAnalyses: number;
  averageScore: number;
  latestGrade: string;
  apiCallsCount: number;
  lastAnalysisDate?: Date;
  averageResponseTime?: number;
}

export function AnalyticsOverviewCards({
  totalAnalyses,
  averageScore,
  latestGrade,
  apiCallsCount,
  lastAnalysisDate,
  averageResponseTime,
}: AnalyticsOverviewCardsProps) {
  const getGradeColor = (grade: string) => {
    switch (grade.toUpperCase()) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-yellow-100 text-yellow-800';
      case 'D':
        return 'bg-orange-100 text-orange-800';
      case 'F':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Analyses */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Analyses totales</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{totalAnalyses}</div>
          <p className="text-xs text-muted-foreground">
            Dernière: {formatDate(lastAnalysisDate)}
          </p>
        </CardContent>
      </Card>

      {/* Average Score */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Score moyen</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{averageScore}/1000</div>
          <p className="text-xs text-muted-foreground">
            {((averageScore / 1000) * 100).toFixed(0)}% de conformité
          </p>
        </CardContent>
      </Card>

      {/* Latest Grade */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Note latest</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-foreground">
              <Badge className={`${getGradeColor(latestGrade)} text-lg font-bold py-1 px-3`}>
                {latestGrade.toUpperCase()}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Dernière analyse
          </p>
        </CardContent>
      </Card>

      {/* API Calls */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Appels API</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{apiCallsCount}</div>
          <p className="text-xs text-muted-foreground">
            {averageResponseTime ? `~${averageResponseTime}ms par appel` : 'Tracking actif'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
