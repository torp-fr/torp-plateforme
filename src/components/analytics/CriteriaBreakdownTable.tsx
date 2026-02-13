/**
 * Criteria Breakdown Table - Detailed scoring for each criterion
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface CriteriaScore {
  axis: string;
  criterionName: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  justification?: string;
}

interface CriteriaBreakdownTableProps {
  criteria: CriteriaScore[];
  byAxis?: boolean;
}

export function CriteriaBreakdownTable({ criteria, byAxis = true }: CriteriaBreakdownTableProps) {
  // Group by axis if requested
  const grouped = byAxis
    ? criteria.reduce(
        (acc, item) => {
          if (!acc[item.axis]) acc[item.axis] = [];
          acc[item.axis].push(item);
          return acc;
        },
        {} as Record<string, CriteriaScore[]>
      )
    : { 'Tous': criteria };

  const getGradeColor = (grade: string) => {
    switch (grade?.toUpperCase()) {
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

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderAxis = (axisName: string, criteria: CriteriaScore[]) => {
    const axisScore = criteria.reduce((sum, c) => sum + c.score, 0);
    const axisMax = criteria.reduce((sum, c) => sum + c.maxScore, 0);
    const axisPercentage = Math.round((axisScore / axisMax) * 100);

    return (
      <div key={axisName} className="space-y-4">
        {/* Axis Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">{axisName}</h4>
            <span className="text-sm text-foreground font-mono">
              {axisScore}/{axisMax}
            </span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(axisPercentage)} transition-all`}
              style={{ width: `${axisPercentage}%` }}
            />
          </div>
        </div>

        {/* Criteria Table for this axis */}
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-foreground">Critère</TableHead>
              <TableHead className="text-right text-foreground">Score</TableHead>
              <TableHead className="text-right text-foreground">%</TableHead>
              <TableHead className="text-center text-foreground">Note</TableHead>
              <TableHead className="text-foreground">Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {criteria.map((item, idx) => (
              <TableRow key={idx} className="border-border hover:bg-accent">
                <TableCell className="text-foreground font-medium">
                  {item.criterionName}
                </TableCell>
                <TableCell className="text-right text-foreground">
                  <span className="font-mono">
                    {item.score}/{item.maxScore}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`${getGradeColor('base')} px-2 py-1 rounded text-foreground font-semibold`}>
                    {item.percentage}%
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={getGradeColor(item.grade)}>
                    {item.grade.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.justification ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button>
                            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">{item.justification}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Détail des critères</CardTitle>
      </CardHeader>

      <CardContent className="space-y-8">
        {Object.entries(grouped).map(([axisName, axisCriteria]) =>
          renderAxis(axisName, axisCriteria)
        )}

        {criteria.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun critère évalué
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export for use in other components
export type { CriteriaScore };
