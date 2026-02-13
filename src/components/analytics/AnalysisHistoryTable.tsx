/**
 * Analysis History Table - Shows past analyses with filtering and sorting
 */

import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnalysisRecord } from '@/types/audit';

interface AnalysisHistoryTableProps {
  analyses: AnalysisRecord[];
  onSelectAnalysis?: (analysis: AnalysisRecord) => void;
  isLoading?: boolean;
}

export function AnalysisHistoryTable({
  analyses,
  onSelectAnalysis,
  isLoading = false,
}: AnalysisHistoryTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterGrade, setFilterGrade] = useState<string | null>(null);

  // Filter analyses
  const filtered = filterGrade
    ? analyses.filter(a => a.finalGrade === filterGrade)
    : analyses;

  // Paginate
  const startIdx = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(startIdx, startIdx + pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

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

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Historique des analyses</CardTitle>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Filtrer par note:</label>
            <Select value={filterGrade || ''} onValueChange={v => setFilterGrade(v || null)}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C">C</SelectItem>
                <SelectItem value="D">D</SelectItem>
                <SelectItem value="F">F</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} analyse(s) trouvée(s)
        </p>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Chargement...
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune analyse trouvée
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-foreground">Date</TableHead>
                  <TableHead className="text-foreground">Score</TableHead>
                  <TableHead className="text-foreground">Note</TableHead>
                  <TableHead className="text-foreground">Entrepreneur</TableHead>
                  <TableHead className="text-foreground">Résumé</TableHead>
                  <TableHead className="text-right text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((analysis) => (
                  <TableRow
                    key={analysis.analysisId}
                    className="border-border cursor-pointer hover:bg-accent"
                    onClick={() => onSelectAnalysis?.(analysis)}
                  >
                    <TableCell className="text-foreground">
                      {formatDate(analysis.analysisDate)}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {analysis.totalScore}/1000
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getGradeColor(analysis.finalGrade)}`}>
                        {analysis.finalGrade.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {analysis.contractorName || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                      {analysis.summary || 'Aucun résumé'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAnalysis?.(analysis);
                        }}
                      >
                        Détails →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Select value={pageSize.toString()} onValueChange={v => setPageSize(parseInt(v))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
