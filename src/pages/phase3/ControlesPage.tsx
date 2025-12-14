/**
 * TORP Phase 3 - Page Contrôles
 * Gestion des contrôles réglementaires et qualité
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
  Shield,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Zap,
  Flame,
  ThermometerSun,
  HardHat,
  FileCheck,
  Calendar,
  Plus,
  Eye,
  ChevronRight,
} from 'lucide-react';

import { ControleService } from '@/services/phase3';
import type {
  OrganismeControle,
  CertificationObligatoire,
  CoordinateurSPS,
  FicheAutoControle,
  GrilleControleQualite,
  AlerteControle,
} from '@/types/phase3';

// ============================================
// HELPERS
// ============================================

const STATUT_CERTIFICATION: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  a_demander: { label: 'À demander', color: 'bg-gray-500', icon: Clock },
  demande_envoyee: { label: 'Demande envoyée', color: 'bg-blue-500', icon: Clock },
  rdv_planifie: { label: 'RDV planifié', color: 'bg-yellow-500', icon: Calendar },
  visite_effectuee: { label: 'Visite effectuée', color: 'bg-orange-500', icon: Eye },
  conforme: { label: 'Conforme', color: 'bg-green-500', icon: CheckCircle2 },
  non_conforme: { label: 'Non conforme', color: 'bg-red-500', icon: XCircle },
  certificat_obtenu: { label: 'Certificat obtenu', color: 'bg-emerald-500', icon: FileCheck },
};

const TYPE_CERTIFICATION_INFO: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  consuel_jaune: { label: 'Consuel (Jaune)', icon: Zap, description: 'Électricité - Usage propre' },
  consuel_bleu: { label: 'Consuel (Bleu)', icon: Zap, description: 'Électricité - Vente/Location' },
  qualigaz: { label: 'Qualigaz', icon: Flame, description: 'Installation gaz' },
  certigaz: { label: 'Certigaz', icon: Flame, description: 'Vérification GRDF' },
  test_etancheite: { label: 'Test étanchéité', icon: ThermometerSun, description: 'RE2020 - Q4Pa-surf' },
  attestation_fin_travaux_re2020: { label: 'Attestation RE2020', icon: ThermometerSun, description: 'Fin travaux Bbio/Cep' },
};

const RESULTAT_AUTOCONTROLE: Record<string, { label: string; color: string; emoji: string }> = {
  conforme: { label: 'Conforme', color: 'text-green-600 bg-green-50', emoji: '✅' },
  reserve_mineure: { label: 'Réserve mineure', color: 'text-yellow-600 bg-yellow-50', emoji: '⚠️' },
  reserve_majeure: { label: 'Réserve majeure', color: 'text-orange-600 bg-orange-50', emoji: '❌' },
  non_conforme: { label: 'Non conforme', color: 'text-red-600 bg-red-50', emoji: '🚫' },
};

const SYNTHESE_QUALITE: Record<string, { label: string; color: string }> = {
  excellent: { label: 'Excellent', color: 'text-emerald-600 bg-emerald-50' },
  satisfaisant: { label: 'Satisfaisant', color: 'text-green-600 bg-green-50' },
  insuffisant: { label: 'Insuffisant', color: 'text-orange-600 bg-orange-50' },
  inacceptable: { label: 'Inacceptable', color: 'text-red-600 bg-red-50' },
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function ControlesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const chantierId = projectId || 'chantier-1'; // Fallback pour démo

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('organismes');

  // Données
  const [organismes, setOrganismes] = useState<OrganismeControle[]>([]);
  const [certifications, setCertifications] = useState<CertificationObligatoire[]>([]);
  const [coordinateurSPS, setCoordinateurSPS] = useState<CoordinateurSPS | null>(null);
  const [fichesAutoControle, setFichesAutoControle] = useState<FicheAutoControle[]>([]);
  const [grillesQualite, setGrillesQualite] = useState<GrilleControleQualite[]>([]);
  const [alertes, setAlertes] = useState<AlerteControle[]>([]);
  const [statistiques, setStatistiques] = useState<Awaited<ReturnType<typeof ControleService.getStatistiques>> | null>(null);

  useEffect(() => {
    loadData();
  }, [chantierId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        organismesData,
        certificationsData,
        spsData,
        fichesData,
        grillesData,
        alertesData,
        statsData,
      ] = await Promise.all([
        ControleService.listOrganismes({ chantierId }),
        ControleService.listCertifications({ chantierId }),
        ControleService.getCoordinateurSPS(chantierId),
        ControleService.listFichesAutoControle({ chantierId }),
        ControleService.listGrillesQualite({ chantierId }),
        ControleService.getAlertes(chantierId),
        ControleService.getStatistiques(chantierId),
      ]);

      setOrganismes(organismesData);
      setCertifications(certificationsData);
      setCoordinateurSPS(spsData);
      setFichesAutoControle(fichesData);
      setGrillesQualite(grillesData);
      setAlertes(alertesData);
      setStatistiques(statsData);
    } catch (error) {
      console.error('Erreur chargement données contrôles:', error);
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

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Contrôles & Qualité
          </h1>
          <p className="text-muted-foreground">
            Contrôles réglementaires, certifications et qualité d'exécution
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau contrôle
        </Button>
      </div>

      {/* Alertes */}
      {alertes.filter(a => !a.lu).length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attention</AlertTitle>
          <AlertDescription>
            {alertes.filter(a => !a.lu).length} alerte(s) de contrôle nécessitent votre attention
          </AlertDescription>
        </Alert>
      )}

      {/* Statistiques */}
      {statistiques && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Organismes</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistiques.organismes.actifs}</div>
              <p className="text-xs text-muted-foreground">
                sur {statistiques.organismes.total} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Réserves</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {statistiques.reserves.enAttente}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistiques.reserves.levees} levées sur {statistiques.reserves.total}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certifications</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistiques.certifications.obtenues}
              </div>
              <p className="text-xs text-muted-foreground">
                sur {statistiques.certifications.total} requises
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conformité</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistiques.qualite.conformiteMoyenne}%</div>
              <Progress value={statistiques.qualite.conformiteMoyenne} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="organismes">Organismes</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="sps">SPS</TabsTrigger>
          <TabsTrigger value="autocontroles">Auto-contrôles</TabsTrigger>
          <TabsTrigger value="qualite">Grilles qualité</TabsTrigger>
        </TabsList>

        {/* Organismes de contrôle */}
        <TabsContent value="organismes" className="space-y-4">
          {organismes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun organisme de contrôle</p>
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un organisme
                </Button>
              </CardContent>
            </Card>
          ) : (
            organismes.map(org => (
              <Card key={org.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {org.nom}
                      </CardTitle>
                      <CardDescription>
                        {org.reference && `Réf: ${org.reference} • `}
                        {org.type === 'bureau_controle' ? 'Bureau de contrôle technique' : org.type}
                      </CardDescription>
                    </div>
                    <Badge variant={org.statut === 'actif' ? 'default' : 'secondary'}>
                      {org.statut === 'actif' ? 'Actif' : 'Terminé'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Missions */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Missions</h4>
                    <div className="grid gap-2">
                      {org.missions.map(mission => (
                        <div
                          key={mission.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{mission.code}</Badge>
                            <span>{mission.libelle}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            {mission.nombreReserves > 0 && (
                              <span className="text-orange-600">
                                {mission.nombreReserves - mission.reservesLevees} réserve(s) en attente
                              </span>
                            )}
                            <Badge
                              variant={mission.statut === 'avis_favorable' ? 'default' : 'secondary'}
                            >
                              {mission.statut.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact */}
                  {org.contact && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Contact: {org.contact.nom}
                        {org.contact.email && ` • ${org.contact.email}`}
                        {org.contact.telephone && ` • ${org.contact.telephone}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Certifications obligatoires */}
        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Certifications obligatoires</CardTitle>
              <CardDescription>
                État des certifications requises pour la mise en service
              </CardDescription>
            </CardHeader>
            <CardContent>
              {certifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune certification requise
                </div>
              ) : (
                <div className="space-y-4">
                  {certifications.map(cert => {
                    const typeInfo = TYPE_CERTIFICATION_INFO[cert.type] || {
                      label: cert.type,
                      icon: FileCheck,
                      description: '',
                    };
                    const statutInfo = STATUT_CERTIFICATION[cert.statut];
                    const StatutIcon = statutInfo?.icon || Clock;

                    return (
                      <div
                        key={cert.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <typeInfo.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{typeInfo.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {typeInfo.description} • {cert.organisme}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {cert.coutHT && (
                            <span className="text-sm text-muted-foreground">
                              {cert.coutHT}€ HT
                            </span>
                          )}
                          <Badge className={statutInfo?.color}>
                            <StatutIcon className="h-3 w-3 mr-1" />
                            {statutInfo?.label || cert.statut}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coordonnateur SPS */}
        <TabsContent value="sps" className="space-y-4">
          {coordinateurSPS ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <HardHat className="h-5 w-5" />
                      Coordonnateur SPS
                    </CardTitle>
                    <CardDescription>
                      Niveau {coordinateurSPS.niveau} • {coordinateurSPS.organisme || 'Indépendant'}
                    </CardDescription>
                  </div>
                  <Badge variant={coordinateurSPS.statut === 'actif' ? 'default' : 'secondary'}>
                    {coordinateurSPS.statut}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Contact</h4>
                    <div className="text-sm space-y-1">
                      <p>{coordinateurSPS.nom}</p>
                      {coordinateurSPS.email && <p className="text-muted-foreground">{coordinateurSPS.email}</p>}
                      {coordinateurSPS.telephone && <p className="text-muted-foreground">{coordinateurSPS.telephone}</p>}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Visites</h4>
                    <div className="text-sm space-y-1">
                      <p>Fréquence: {coordinateurSPS.frequenceVisites}</p>
                      {coordinateurSPS.prochainVisite && (
                        <p className="text-primary">
                          Prochaine visite: {new Date(coordinateurSPS.prochainVisite).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Documents SPS */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Documents</h4>
                  <div className="flex flex-wrap gap-2">
                    {coordinateurSPS.pgcUrl && (
                      <Badge variant="outline">PGC disponible</Badge>
                    )}
                    {coordinateurSPS.registreJournalUrl && (
                      <Badge variant="outline">Registre journal</Badge>
                    )}
                    {coordinateurSPS.diuoUrl && (
                      <Badge variant="outline">DIUO</Badge>
                    )}
                    {!coordinateurSPS.pgcUrl && !coordinateurSPS.registreJournalUrl && (
                      <span className="text-sm text-muted-foreground">Aucun document</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <HardHat className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun coordonnateur SPS assigné</p>
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un coordonnateur
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Fiches d'auto-contrôle */}
        <TabsContent value="autocontroles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fiches d'auto-contrôle</CardTitle>
                  <CardDescription>
                    Contrôles réalisés par les entreprises
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle fiche
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fichesAutoControle.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune fiche d'auto-contrôle
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead>Objet</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Résultat</TableHead>
                      <TableHead>Validation MOE</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fichesAutoControle.map(fiche => {
                      const resultatInfo = RESULTAT_AUTOCONTROLE[fiche.resultat];
                      return (
                        <TableRow key={fiche.id}>
                          <TableCell>
                            {new Date(fiche.dateControle).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="font-medium">{fiche.entreprise}</TableCell>
                          <TableCell>{fiche.lot}</TableCell>
                          <TableCell>{fiche.objet}</TableCell>
                          <TableCell>{fiche.zone || '-'}</TableCell>
                          <TableCell>
                            <Badge className={resultatInfo.color}>
                              {resultatInfo.emoji} {resultatInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {fiche.validationMOE ? (
                              <Badge variant={fiche.validationMOE.avis === 'valide' ? 'default' : 'destructive'}>
                                {fiche.validationMOE.avis}
                              </Badge>
                            ) : (
                              <Badge variant="outline">En attente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
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

        {/* Grilles de contrôle qualité */}
        <TabsContent value="qualite" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Grilles de contrôle qualité</CardTitle>
                  <CardDescription>
                    Évaluation qualité par corps d'état
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle grille
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {grillesQualite.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune grille de contrôle
                </div>
              ) : (
                <div className="space-y-4">
                  {grillesQualite.map(grille => {
                    const syntheseInfo = SYNTHESE_QUALITE[grille.syntheseQualite];
                    return (
                      <div
                        key={grille.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div>
                          <div className="font-medium">{grille.lot}</div>
                          <div className="text-sm text-muted-foreground">
                            {grille.categorie.replace('_', ' ')}
                            {grille.zone && ` • ${grille.zone}`}
                            {' • '}
                            {new Date(grille.dateControle).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {grille.pourcentageConformite}%
                            </div>
                            <Progress
                              value={grille.pourcentageConformite}
                              className="w-24 mt-1"
                            />
                          </div>
                          <Badge className={syntheseInfo?.color}>
                            {syntheseInfo?.label || grille.syntheseQualite}
                          </Badge>
                          {grille.valide ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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
