/**
 * TORP Phase 3 - Page Situations & Administratif
 * Gestion des situations de travaux, budget, avenants et litiges
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Euro,
  Plus,
  Eye,
  ChevronRight,
  Download,
  Send,
  Gavel,
  FolderOpen,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

import { AdministratifService } from '@/services/phase3';
import type {
  SituationTravaux,
  SuiviBudgetaire,
  Avenant,
  DossierOuvragesExecutes,
  Litige,
  AlerteAdministrative,
} from '@/types/phase3';

// ============================================
// HELPERS
// ============================================

const STATUT_SITUATION: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-500', icon: Clock },
  soumise: { label: 'Soumise', color: 'bg-blue-500', icon: Send },
  en_verification: { label: 'En vérification', color: 'bg-yellow-500', icon: Eye },
  validee_moe: { label: 'Validée MOE', color: 'bg-orange-500', icon: CheckCircle2 },
  validee_mo: { label: 'Validée MO', color: 'bg-green-500', icon: CheckCircle2 },
  facturee: { label: 'Facturée', color: 'bg-purple-500', icon: Receipt },
  payee: { label: 'Payée', color: 'bg-emerald-500', icon: CheckCircle2 },
  contestee: { label: 'Contestée', color: 'bg-red-500', icon: XCircle },
};

const STATUT_AVENANT: Record<string, { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-500' },
  soumis: { label: 'Soumis', color: 'bg-blue-500' },
  en_negociation: { label: 'En négociation', color: 'bg-yellow-500' },
  accepte: { label: 'Accepté', color: 'bg-green-500' },
  refuse: { label: 'Refusé', color: 'bg-red-500' },
  signe: { label: 'Signé', color: 'bg-emerald-500' },
};

const GRAVITE_LITIGE: Record<string, { label: string; color: string }> = {
  mineur: { label: 'Mineur', color: 'text-yellow-600 bg-yellow-50' },
  modere: { label: 'Modéré', color: 'text-orange-600 bg-orange-50' },
  grave: { label: 'Grave', color: 'text-red-600 bg-red-50' },
  critique: { label: 'Critique', color: 'text-red-800 bg-red-100' },
};

const NIVEAU_ESCALADE: Record<string, string> = {
  niveau1_discussion: 'Discussion',
  niveau2_reunion: 'Réunion formelle',
  niveau3_mise_demeure: 'Mise en demeure',
  niveau4_suspension: 'Suspension',
  niveau5_resiliation: 'Résiliation',
  mediation: 'Médiation',
  contentieux: 'Contentieux',
};

// Formateur monétaire
const formatMoney = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function SituationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const chantierId = projectId || 'chantier-1';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('situations');

  // Données
  const [situations, setSituations] = useState<SituationTravaux[]>([]);
  const [suiviBudget, setSuiviBudget] = useState<SuiviBudgetaire | null>(null);
  const [avenants, setAvenants] = useState<Avenant[]>([]);
  const [doe, setDOE] = useState<DossierOuvragesExecutes | null>(null);
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [alertes, setAlertes] = useState<AlerteAdministrative[]>([]);

  useEffect(() => {
    loadData();
  }, [chantierId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        situationsData,
        budgetData,
        avenantsData,
        doeData,
        litigesData,
        alertesData,
      ] = await Promise.all([
        AdministratifService.listSituations({ chantierId }),
        AdministratifService.calculerSuiviBudgetaire(chantierId),
        AdministratifService.listAvenants({ chantierId }),
        AdministratifService.getDOE(chantierId),
        AdministratifService.listLitiges({ chantierId }),
        AdministratifService.getAlertes(chantierId),
      ]);

      setSituations(situationsData);
      setSuiviBudget(budgetData);
      setAvenants(avenantsData);
      setDOE(doeData);
      setLitiges(litigesData);
      setAlertes(alertesData);
    } catch (error) {
      console.error('Erreur chargement données administratives:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Calculs résumé
  const totalSituationsPayees = situations
    .filter(s => s.statut === 'payee')
    .reduce((sum, s) => sum + s.netAPayerTTC, 0);

  const totalSituationsEnAttente = situations
    .filter(s => s.statut !== 'payee' && s.statut !== 'brouillon')
    .reduce((sum, s) => sum + s.netAPayerTTC, 0);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Gestion administrative
          </h1>
          <p className="text-muted-foreground">
            Situations de travaux, budget, avenants et litiges
          </p>
        </div>
      </div>

      {/* Alertes */}
      {alertes.filter(a => !a.lu).length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Actions requises</AlertTitle>
          <AlertDescription>
            {alertes.filter(a => !a.lu).length} alerte(s) administrative(s) en attente
          </AlertDescription>
        </Alert>
      )}

      {/* Résumé financier */}
      {suiviBudget && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget initial</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(suiviBudget.totalMarcheHT)}</div>
              <p className="text-xs text-muted-foreground">HT</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget actualisé</CardTitle>
              {suiviBudget.depassementPourcent > 0 ? (
                <ArrowUpRight className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(suiviBudget.totalActualiseHT)}</div>
              {suiviBudget.depassementPourcent > 0 && (
                <p className="text-xs text-red-600">
                  +{suiviBudget.depassementPourcent.toFixed(1)}% ({formatMoney(suiviBudget.depassementGlobalHT)})
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payé</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatMoney(suiviBudget.totalSituationsPaveesHT)}</div>
              <Progress value={suiviBudget.pourcentageConsomme} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {suiviBudget.pourcentageConsomme.toFixed(0)}% consommé
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reste à payer</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(suiviBudget.totalResteAPayerHT)}</div>
              <p className="text-xs text-muted-foreground">HT</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="situations">Situations</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="avenants">Avenants</TabsTrigger>
          <TabsTrigger value="doe">DOE</TabsTrigger>
          <TabsTrigger value="litiges">Litiges</TabsTrigger>
        </TabsList>

        {/* Situations de travaux */}
        <TabsContent value="situations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Situations de travaux</CardTitle>
                  <CardDescription>
                    Acomptes et facturation des entreprises
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle situation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {situations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune situation de travaux
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Montant HT</TableHead>
                      <TableHead>TVA</TableHead>
                      <TableHead>Net TTC</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {situations.map(situation => {
                      const statutInfo = STATUT_SITUATION[situation.statut];
                      const StatutIcon = statutInfo?.icon || Clock;
                      return (
                        <TableRow key={situation.id}>
                          <TableCell className="font-medium">
                            Situation n°{situation.numero}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(situation.periodeDebut).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              au {new Date(situation.periodeFin).toLocaleDateString('fr-FR')}
                            </div>
                          </TableCell>
                          <TableCell>{formatMoney(situation.netAPayerHT)}</TableCell>
                          <TableCell>{formatMoney(situation.montantTVA)}</TableCell>
                          <TableCell className="font-bold">{formatMoney(situation.netAPayerTTC)}</TableCell>
                          <TableCell>
                            <Badge className={statutInfo?.color}>
                              <StatutIcon className="h-3 w-3 mr-1" />
                              {statutInfo?.label || situation.statut}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suivi budgétaire */}
        <TabsContent value="budget" className="space-y-4">
          {suiviBudget && (
            <>
              {/* Alertes budget */}
              {suiviBudget.alertes.length > 0 && (
                <div className="space-y-2">
                  {suiviBudget.alertes.map((alerte, index) => (
                    <Alert key={index} variant={alerte.niveau === 'error' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{alerte.type.replace('_', ' ')}</AlertTitle>
                      <AlertDescription>{alerte.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Suivi par lot</CardTitle>
                  <CardDescription>
                    État financier détaillé par corps d'état
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lot</TableHead>
                        <TableHead>Entreprise</TableHead>
                        <TableHead>Marché HT</TableHead>
                        <TableHead>Avenants</TableHead>
                        <TableHead>Total actualisé</TableHead>
                        <TableHead>Payé</TableHead>
                        <TableHead>Reste</TableHead>
                        <TableHead>Écart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suiviBudget.lots.map(lot => (
                        <TableRow key={lot.lotId}>
                          <TableCell className="font-medium">{lot.lotNom}</TableCell>
                          <TableCell>{lot.entreprise}</TableCell>
                          <TableCell>{formatMoney(lot.montantMarcheHT)}</TableCell>
                          <TableCell>
                            {lot.totalAvenantsHT > 0 ? (
                              <span className="text-orange-600">+{formatMoney(lot.totalAvenantsHT)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{formatMoney(lot.montantActualiseHT)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{formatMoney(lot.situationsPayeesHT)}</span>
                              <Progress value={lot.pourcentagePaye} className="w-16" />
                            </div>
                          </TableCell>
                          <TableCell>{formatMoney(lot.resteAPayerHT)}</TableCell>
                          <TableCell>
                            {lot.depassementPourcent !== 0 && (
                              <Badge
                                variant={lot.depassementPourcent > 10 ? 'destructive' : 'outline'}
                                className={lot.depassementPourcent > 0 ? 'text-red-600' : 'text-green-600'}
                              >
                                {lot.depassementPourcent > 0 ? '+' : ''}{lot.depassementPourcent.toFixed(1)}%
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totaux */}
                  <div className="mt-4 pt-4 border-t">
                    <Table>
                      <TableBody>
                        <TableRow className="font-bold">
                          <TableCell colSpan={2}>TOTAL</TableCell>
                          <TableCell>{formatMoney(suiviBudget.totalMarcheHT)}</TableCell>
                          <TableCell className="text-orange-600">
                            +{formatMoney(suiviBudget.totalAvenantsHT)}
                          </TableCell>
                          <TableCell>{formatMoney(suiviBudget.totalActualiseHT)}</TableCell>
                          <TableCell>{formatMoney(suiviBudget.totalSituationsPaveesHT)}</TableCell>
                          <TableCell>{formatMoney(suiviBudget.totalResteAPayerHT)}</TableCell>
                          <TableCell>
                            {suiviBudget.depassementPourcent !== 0 && (
                              <Badge
                                variant={suiviBudget.depassementPourcent > 10 ? 'destructive' : 'outline'}
                              >
                                {suiviBudget.depassementPourcent > 0 ? '+' : ''}{suiviBudget.depassementPourcent.toFixed(1)}%
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Avenants */}
        <TabsContent value="avenants" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Avenants</CardTitle>
                  <CardDescription>
                    Travaux supplémentaires et modifications de marché
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvel avenant
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {avenants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun avenant
                </div>
              ) : (
                <div className="space-y-4">
                  {avenants.map(avenant => {
                    const statutInfo = STATUT_AVENANT[avenant.statut];
                    return (
                      <div
                        key={avenant.id}
                        className="p-4 rounded-lg border"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              Avenant n°{avenant.numero} - {avenant.objet}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {avenant.type.replace('_', ' ')} • {avenant.justification}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className={`text-lg font-bold ${avenant.montantAvenantHT >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {avenant.montantAvenantHT >= 0 ? '+' : ''}{formatMoney(avenant.montantAvenantHT)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {avenant.impactPourcent >= 0 ? '+' : ''}{avenant.impactPourcent.toFixed(1)}% du marché
                              </div>
                            </div>
                            <Badge className={statutInfo?.color}>
                              {statutInfo?.label || avenant.statut}
                            </Badge>
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Impact délai */}
                        {avenant.impactDelaiJours > 0 && (
                          <div className="mt-2 text-sm">
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              +{avenant.impactDelaiJours} jours
                            </Badge>
                          </div>
                        )}

                        {/* Validations */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t text-sm">
                          <div className="flex items-center gap-2">
                            {avenant.validationMOE ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>MOE</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {avenant.validationMO ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>MO</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {avenant.signature ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>Signature</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOE */}
        <TabsContent value="doe" className="space-y-4">
          {doe && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5" />
                      Dossier Ouvrages Exécutés (DOE)
                    </CardTitle>
                    <CardDescription>
                      Documents à fournir par les entreprises
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {doe.pourcentageComplet.toFixed(0)}%
                    </div>
                    <Progress value={doe.pourcentageComplet} className="w-32" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {doe.lots.map(lot => (
                    <div key={lot.lotId} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium">{lot.lotNom}</div>
                          <div className="text-sm text-muted-foreground">{lot.entreprise}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm">
                              {lot.totalFournis}/{lot.totalAttendus} documents
                            </div>
                            <Progress
                              value={lot.pourcentageComplet}
                              className="w-24 mt-1"
                            />
                          </div>
                          <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Ajouter
                          </Button>
                        </div>
                      </div>

                      {/* Documents attendus */}
                      <div className="space-y-2">
                        {lot.documentsAttendus.map(docAttendu => {
                          const docFourni = lot.documentsFournis.find(d => d.type === docAttendu.type);
                          return (
                            <div
                              key={docAttendu.id}
                              className={`flex items-center justify-between p-2 rounded ${
                                docFourni ? 'bg-green-50' : docAttendu.obligatoire ? 'bg-red-50' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {docFourni ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm">{docAttendu.libelle}</span>
                                {docAttendu.obligatoire && !docFourni && (
                                  <Badge variant="destructive" className="text-xs">Obligatoire</Badge>
                                )}
                              </div>
                              {docFourni && (
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Litiges */}
        <TabsContent value="litiges" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="h-5 w-5" />
                    Litiges
                  </CardTitle>
                  <CardDescription>
                    Gestion des différends et escalade
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Signaler un litige
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {litiges.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">Aucun litige en cours</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {litiges.map(litige => {
                    const graviteInfo = GRAVITE_LITIGE[litige.gravite];
                    return (
                      <Card
                        key={litige.id}
                        className={`border-l-4 ${
                          litige.gravite === 'critique' ? 'border-l-red-600' :
                          litige.gravite === 'grave' ? 'border-l-red-400' :
                          litige.gravite === 'modere' ? 'border-l-orange-500' :
                          'border-l-yellow-500'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{litige.objet}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {litige.description}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span>
                                  Signalé le {new Date(litige.dateSignalement).toLocaleDateString('fr-FR')}
                                </span>
                                {litige.impactFinancierEstime && (
                                  <Badge variant="outline">
                                    Impact: {formatMoney(litige.impactFinancierEstime)}
                                  </Badge>
                                )}
                                {litige.impactDelaiEstime && (
                                  <Badge variant="outline">
                                    +{litige.impactDelaiEstime} jours
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={graviteInfo?.color}>
                                {graviteInfo?.label || litige.gravite}
                              </Badge>
                              <Badge variant="outline">
                                {NIVEAU_ESCALADE[litige.niveauActuel] || litige.niveauActuel}
                              </Badge>
                            </div>
                          </div>

                          {/* Parties */}
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center gap-4 text-sm">
                              {litige.parties.map((partie, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Badge variant={partie.role === 'demandeur' ? 'default' : 'secondary'}>
                                    {partie.role}
                                  </Badge>
                                  <span>{partie.nom}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Historique escalade */}
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2 overflow-x-auto">
                              {litige.historiqueEscalade.map((etape, index) => (
                                <React.Fragment key={index}>
                                  <div
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${
                                      etape.resultat === 'succes' ? 'bg-green-100 text-green-800' :
                                      etape.resultat === 'echec' ? 'bg-red-100 text-red-800' :
                                      'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {NIVEAU_ESCALADE[etape.niveau]}
                                  </div>
                                  {index < litige.historiqueEscalade.length - 1 && (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" size="sm">
                              Voir détails
                            </Button>
                            {litige.statut !== 'resolu' && litige.statut !== 'clos' && (
                              <Button size="sm">
                                Escalader
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
