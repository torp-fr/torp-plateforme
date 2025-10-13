import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Euro,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Calculator
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BudgetLine {
  id: string;
  category: string;
  description: string;
  budgetInitial: number;
  depenseActuelle: number;
  depensePrevue: number;
  status: "ok" | "warning" | "alert";
  variance: number;
}

export const ProjectBudget = ({ projectId }: { projectId: string }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Mock data
  const budgetLines: BudgetLine[] = [
    {
      id: "1",
      category: "Gros œuvre",
      description: "Fondations, structure, couverture",
      budgetInitial: 45000,
      depenseActuelle: 42000,
      depensePrevue: 46500,
      status: "warning",
      variance: 3.3
    },
    {
      id: "2",
      category: "Second œuvre - Isolation",
      description: "Isolation thermique et phonique",
      budgetInitial: 12000,
      depenseActuelle: 8000,
      depensePrevue: 11500,
      status: "ok",
      variance: -4.2
    },
    {
      id: "3",
      category: "Second œuvre - Menuiseries",
      description: "Fenêtres, portes, volets",
      budgetInitial: 18000,
      depenseActuelle: 15000,
      depensePrevue: 17800,
      status: "ok",
      variance: -1.1
    },
    {
      id: "4",
      category: "Plomberie",
      description: "Sanitaires, chauffage, VMC",
      budgetInitial: 15000,
      depenseActuelle: 12000,
      depensePrevue: 16200,
      status: "alert",
      variance: 8.0
    },
    {
      id: "5",
      category: "Électricité",
      description: "Tableau, câblage, prises",
      budgetInitial: 10000,
      depenseActuelle: 7500,
      depensePrevue: 9800,
      status: "ok",
      variance: -2.0
    },
    {
      id: "6",
      category: "Finitions",
      description: "Peinture, carrelage, parquet",
      budgetInitial: 20000,
      depenseActuelle: 5000,
      depensePrevue: 19500,
      status: "ok",
      variance: -2.5
    }
  ];

  const budgetTotal = budgetLines.reduce((acc, line) => acc + line.budgetInitial, 0);
  const depenseActuelle = budgetLines.reduce((acc, line) => acc + line.depenseActuelle, 0);
  const depensePrevue = budgetLines.reduce((acc, line) => acc + line.depensePrevue, 0);
  const varianceTotal = ((depensePrevue - budgetTotal) / budgetTotal) * 100;
  const budgetRestant = budgetTotal - depenseActuelle;
  const progressionDepense = (depenseActuelle / budgetTotal) * 100;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok": return "text-green-500";
      case "warning": return "text-yellow-500";
      case "alert": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok": return <Badge className="bg-green-500">Dans le budget</Badge>;
      case "warning": return <Badge className="bg-yellow-500">Surveillance</Badge>;
      case "alert": return <Badge className="bg-red-500">Dépassement</Badge>;
      default: return <Badge variant="outline">Non défini</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Vue d'ensemble */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget total</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {budgetTotal.toLocaleString('fr-FR')} €
            </div>
            <p className="text-xs text-muted-foreground">
              Budget initial du projet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépensé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {depenseActuelle.toLocaleString('fr-FR')} €
            </div>
            <p className="text-xs text-muted-foreground">
              {progressionDepense.toFixed(1)}% du budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restant</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {budgetRestant.toLocaleString('fr-FR')} €
            </div>
            <p className="text-xs text-muted-foreground">
              {((budgetRestant / budgetTotal) * 100).toFixed(1)}% disponible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            {varianceTotal > 0 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${varianceTotal > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {varianceTotal > 0 ? '+' : ''}{varianceTotal.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.abs(depensePrevue - budgetTotal).toLocaleString('fr-FR')} € d'écart
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progression */}
      <Card>
        <CardHeader>
          <CardTitle>Progression budgétaire</CardTitle>
          <CardDescription>
            Consommation du budget par rapport au planning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Budget consommé</span>
              <span className="font-semibold">
                {depenseActuelle.toLocaleString('fr-FR')} € / {budgetTotal.toLocaleString('fr-FR')} €
              </span>
            </div>
            <Progress value={progressionDepense} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progressionDepense.toFixed(1)}% utilisé</span>
              <span>{(100 - progressionDepense).toFixed(1)}% restant</span>
            </div>
          </div>

          {varianceTotal > 5 && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium text-red-900">
                  Alerte dépassement budgétaire
                </div>
                <div className="text-sm text-red-700">
                  Le budget prévisionnel dépasse le budget initial de {Math.abs(depensePrevue - budgetTotal).toLocaleString('fr-FR')} € 
                  ({varianceTotal.toFixed(1)}%). Nous vous recommandons de revoir certains postes de dépense.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détail par poste */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par poste de dépense</CardTitle>
          <CardDescription>
            Analyse comparative budget initial vs dépenses prévues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poste</TableHead>
                <TableHead className="text-right">Budget initial</TableHead>
                <TableHead className="text-right">Dépensé</TableHead>
                <TableHead className="text-right">Prévu</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{line.category}</div>
                      <div className="text-sm text-muted-foreground">{line.description}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {line.budgetInitial.toLocaleString('fr-FR')} €
                  </TableCell>
                  <TableCell className="text-right">
                    {line.depenseActuelle.toLocaleString('fr-FR')} €
                    <div className="text-xs text-muted-foreground">
                      {((line.depenseActuelle / line.budgetInitial) * 100).toFixed(0)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {line.depensePrevue.toLocaleString('fr-FR')} €
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`flex items-center justify-end gap-1 ${
                      line.variance > 0 ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {line.variance > 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {line.variance > 0 ? '+' : ''}{line.variance.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {getStatusBadge(line.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recommandations IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Recommandations budgétaires IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 rounded-lg border">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium">Optimisation plomberie</div>
                  <div className="text-sm text-muted-foreground">
                    Le poste plomberie présente un dépassement de 8%. Nous recommandons de négocier 
                    le remplacement du système de chauffage par une alternative moins coûteuse 
                    (économie potentielle : 2 500 €).
                  </div>
                  <Button variant="outline" size="sm" className="mt-2">
                    Voir alternatives
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium">Économie isolation</div>
                  <div className="text-sm text-muted-foreground">
                    Le poste isolation est sous budget de 500 €. Cette économie peut être réallouée 
                    pour améliorer la qualité des menuiseries.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium">Aides financières disponibles</div>
                  <div className="text-sm text-muted-foreground">
                    Votre projet est éligible à MaPrimeRénov' (jusqu'à 4 500 €) et au crédit d'impôt 
                    transition énergétique. Nous pouvons vous aider à constituer les dossiers.
                  </div>
                  <Button variant="outline" size="sm" className="mt-2">
                    En savoir plus
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
