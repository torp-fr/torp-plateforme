import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, Euro, Clock, Star } from 'lucide-react';

interface ComparisonProps {
  currentProjectId: string;
}

export function ProjectComparison({ currentProjectId }: ComparisonProps) {
  const { projects } = useApp();
  const [selectedProject, setSelectedProject] = useState<string>('');
  
  const currentProject = projects.find(p => p.id === currentProjectId);
  const compareProject = projects.find(p => p.id === selectedProject);
  
  const availableProjects = projects.filter(p => 
    p.id !== currentProjectId && 
    p.status === 'completed' && 
    p.analysisResult
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getGradeColor = (grade: string) => {
    if (grade === 'A') return 'bg-success text-white';
    if (grade === 'B') return 'bg-warning text-white';
    return 'bg-destructive text-white';
  };

  const getBetterOption = (current: any, compare: any, metric: string) => {
    const currentValue = current?.[metric];
    const compareValue = compare?.[metric];
    
    if (!currentValue || !compareValue) return 'equal';
    
    if (metric === 'score') {
      return currentValue > compareValue ? 'current' : compareValue > currentValue ? 'compare' : 'equal';
    }
    
    if (metric === 'price') {
      const currentPrice = parseFloat(current.amount?.replace(/[^0-9]/g, '') || '0');
      const comparePrice = parseFloat(compare.amount?.replace(/[^0-9]/g, '') || '0');
      return currentPrice < comparePrice ? 'current' : comparePrice < currentPrice ? 'compare' : 'equal';
    }
    
    return 'equal';
  };

  if (!currentProject) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Projet non trouvé</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Comparaison de devis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {availableProjects.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun autre devis à comparer
            </h3>
            <p className="text-muted-foreground">
              Analysez d'autres devis pour pouvoir les comparer et choisir la meilleure option.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Comparer avec un autre devis :
              </label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un devis à comparer" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {project.company} ({project.grade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {compareProject && (
              <div className="space-y-6">
                {/* Comparaison des scores */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="text-center">
                      <h4 className="font-semibold text-foreground mb-2">Devis actuel</h4>
                      <div className={`text-3xl font-bold mb-1 ${getScoreColor(currentProject.score || 0)}`}>
                        {currentProject.grade}
                      </div>
                      <div className="text-lg text-muted-foreground">
                        {currentProject.score}/100
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        {currentProject.name}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {currentProject.company}
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center">
                      <h4 className="font-semibold text-foreground mb-2">Devis comparé</h4>
                      <div className={`text-3xl font-bold mb-1 ${getScoreColor(compareProject.score || 0)}`}>
                        {compareProject.grade}
                      </div>
                      <div className="text-lg text-muted-foreground">
                        {compareProject.score}/100
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        {compareProject.name}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {compareProject.company}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Comparaison détaillée */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Comparaison détaillée</h4>
                  
                  {/* Prix */}
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Euro className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Prix</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-lg font-semibold ${
                        getBetterOption(currentProject, compareProject, 'price') === 'current' 
                          ? 'text-success' : 'text-foreground'
                      }`}>
                        {currentProject.amount}
                      </div>
                      <span className="text-muted-foreground">vs</span>
                      <div className={`text-lg font-semibold ${
                        getBetterOption(currentProject, compareProject, 'price') === 'compare' 
                          ? 'text-success' : 'text-foreground'
                      }`}>
                        {compareProject.amount}
                      </div>
                    </div>
                  </div>

                  {/* Score TORP */}
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Score TORP</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-lg font-semibold ${
                        getBetterOption(currentProject, compareProject, 'score') === 'current' 
                          ? 'text-success' : 'text-foreground'
                      }`}>
                        {currentProject.score}/100
                      </div>
                      <span className="text-muted-foreground">vs</span>
                      <div className={`text-lg font-semibold ${
                        getBetterOption(currentProject, compareProject, 'score') === 'compare' 
                          ? 'text-success' : 'text-foreground'
                      }`}>
                        {compareProject.score}/100
                      </div>
                    </div>
                  </div>

                  {/* Points forts comparison */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-foreground mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Points forts - Devis actuel
                      </h5>
                      <ul className="space-y-2">
                        {currentProject.analysisResult?.strengths?.slice(0, 3).map((strength: string, index: number) => (
                          <li key={`strength-current-${index}`} className="text-sm text-muted-foreground flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-success rounded-full mt-2 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-foreground mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Points forts - Devis comparé
                      </h5>
                      <ul className="space-y-2">
                        {compareProject.analysisResult?.strengths?.slice(0, 3).map((strength: string, index: number) => (
                          <li key={`strength-compare-${index}`} className="text-sm text-muted-foreground flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-success rounded-full mt-2 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Recommandation */}
                <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                  <h4 className="font-semibold text-info mb-2">Recommandation TORP</h4>
                  <p className="text-sm text-foreground">
                    {getBetterOption(currentProject, compareProject, 'score') === 'current' 
                      ? `Le devis actuel obtient un meilleur score (${currentProject.score}/100 vs ${compareProject.score}/100). `
                      : getBetterOption(currentProject, compareProject, 'score') === 'compare'
                      ? `Le devis comparé obtient un meilleur score (${compareProject.score}/100 vs ${currentProject.score}/100). `
                      : 'Les deux devis ont des scores similaires. '
                    }
                    {getBetterOption(currentProject, compareProject, 'price') === 'current' 
                      ? 'De plus, il est moins cher.'
                      : getBetterOption(currentProject, compareProject, 'price') === 'compare'
                      ? 'Cependant, l\'autre devis est moins cher.'
                      : 'Les prix sont équivalents.'
                    }
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}