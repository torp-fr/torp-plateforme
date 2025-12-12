/**
 * Page de détail d'un projet Phase 0
 * Affiche le résumé, les estimations et les documents générés
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Edit, FileText, Download, RefreshCw, User, Building, MapPin,
  Hammer, Euro, Calendar, Clock, AlertTriangle, Loader2, CheckCircle2,
  FileCheck, FileOutput, Printer, Share2, FileSearch, ArrowRight
} from 'lucide-react';
import {
  Phase0ProjectService,
  Phase0Project,
  PHASE0_STATUS_CONFIG,
  DocumentGeneratorService,
  GeneratedDocument,
  EstimationService,
  ProjectEstimation,
  LOT_CATALOG,
} from '@/services/phase0';
import { useToast } from '@/hooks/use-toast';

export function Phase0ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Phase0Project | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [estimation, setEstimation] = useState<ProjectEstimation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger le projet
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        const [projectData, projectDocs] = await Promise.all([
          Phase0ProjectService.getProjectById(projectId),
          DocumentGeneratorService.getProjectDocuments(projectId),
        ]);

        if (!projectData) {
          setError('Projet non trouvé');
          return;
        }

        setProject(projectData);
        setDocuments(projectDocs);

        // Calculer l'estimation
        const est = EstimationService.estimateProject(projectData);
        setEstimation(est);
      } catch (err) {
        console.error('Erreur chargement projet:', err);
        setError('Impossible de charger le projet');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  // Générer un document
  const generateDocument = useCallback(async (type: 'ccf' | 'aps' | 'cctp') => {
    if (!project) return;

    setIsGeneratingDoc(true);
    try {
      const doc = await DocumentGeneratorService.generateDocument(project, type);
      setDocuments(prev => [doc, ...prev]);
      toast({
        title: 'Document généré',
        description: `${doc.title} créé avec succès`,
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le document',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingDoc(false);
    }
  }, [project, toast]);

  // Exporter un document
  const exportDocument = useCallback((doc: GeneratedDocument) => {
    const text = DocumentGeneratorService.exportToText(doc);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Projet non trouvé'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/phase0/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux projets
        </Button>
      </div>
    );
  }

  const statusConfig = PHASE0_STATUS_CONFIG[project.status];

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link to="/phase0/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Mes projets
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/phase0/wizard/${project.id}`)}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
            <Button variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Partager
            </Button>
            <Button onClick={() => navigate(`/phase0/project/${project.id}/analyze`)}>
              <FileSearch className="w-4 h-4 mr-2" />
              Analyser un devis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* En-tête du projet */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono">
                    {project.reference}
                  </Badge>
                  <Badge variant={project.status === 'validated' ? 'default' : 'secondary'}>
                    {statusConfig.label}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">
                  {project.workProject?.general?.title || 'Projet sans titre'}
                </CardTitle>
                {project.workProject?.general?.description && (
                  <CardDescription className="mt-2">
                    {project.workProject.general.description}
                  </CardDescription>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Complétude</div>
                <div className="text-2xl font-bold text-primary">{project.completeness || 0}%</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Contenu principal */}
        <Tabs defaultValue="summary">
          <TabsList className="mb-6">
            <TabsTrigger value="summary">Résumé</TabsTrigger>
            <TabsTrigger value="estimation">Estimation</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {/* Onglet Résumé */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Maître d'ouvrage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Maître d'ouvrage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Profil: </span>
                    <span className="font-medium">
                      {project.owner?.identity?.type === 'b2c' ? 'Particulier' : 'Professionnel'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact: </span>
                    <span className="font-medium">
                      {project.owner?.identity?.type === 'b2c'
                        ? `${project.owner?.identity?.firstName || ''} ${project.owner?.identity?.lastName || ''}`
                        : project.owner?.identity?.companyName || 'Non renseigné'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <span>{project.owner?.contact?.email || 'Non renseigné'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Bien */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" />
                    Bien
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>
                      {project.property?.address?.street || 'Adresse non renseignée'}
                      <br />
                      {project.property?.address?.postalCode} {project.property?.address?.city}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="font-medium">{project.property?.characteristics?.type || 'Non défini'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Surface: </span>
                    <span>{project.property?.characteristics?.livingArea || '?'} m²</span>
                  </div>
                </CardContent>
              </Card>

              {/* Projet */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Hammer className="w-5 h-5 text-primary" />
                    Travaux
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="font-medium">{project.workProject?.scope?.workType || 'Non défini'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lots sélectionnés: </span>
                    <span>{project.selectedLots?.length || 0}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {project.selectedLots?.slice(0, 5).map(lot => {
                      const catalogLot = LOT_CATALOG.find(l => l.type === lot.type);
                      return (
                        <Badge key={lot.id} variant="outline" className="text-xs">
                          {catalogLot?.number}. {lot.name}
                        </Badge>
                      );
                    })}
                    {(project.selectedLots?.length || 0) > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{(project.selectedLots?.length || 0) - 5} autres
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Budget et planning */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Euro className="w-5 h-5 text-primary" />
                    Budget et planning
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Euro className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Enveloppe: </span>
                    <span className="font-medium">
                      {project.workProject?.budget?.totalEnvelope?.min?.toLocaleString('fr-FR')} € - {project.workProject?.budget?.totalEnvelope?.max?.toLocaleString('fr-FR')} €
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Début souhaité: </span>
                    <span>
                      {project.workProject?.constraints?.temporal?.desiredStartDate
                        ? new Date(project.workProject.constraints.temporal.desiredStartDate).toLocaleDateString('fr-FR')
                        : 'Non défini'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Finition: </span>
                    <span>{project.workProject?.quality?.finishLevel || 'Standard'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Onglet Estimation */}
          <TabsContent value="estimation" className="space-y-6">
            {estimation && (
              <>
                {/* Résumé estimation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Budget estimé</div>
                      <div className="text-2xl font-bold text-primary">
                        {estimation.budget.total.min.toLocaleString('fr-FR')} € - {estimation.budget.total.max.toLocaleString('fr-FR')} €
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Durée estimée</div>
                      <div className="text-2xl font-bold">
                        {estimation.duration.totalWeeks.min} - {estimation.duration.totalWeeks.max} semaines
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Confiance</div>
                      <div className="text-2xl font-bold">
                        {estimation.confidence}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Détail par catégorie */}
                <Card>
                  <CardHeader>
                    <CardTitle>Répartition par catégorie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {estimation.budget.byCategory.map((cat) => (
                        <div key={cat.category} className="flex items-center gap-4">
                          <div className="w-32 text-sm font-medium">{cat.categoryName}</div>
                          <div className="flex-1">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${cat.percentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-sm text-right w-32">
                            {cat.estimate.min.toLocaleString('fr-FR')} € - {cat.estimate.max.toLocaleString('fr-FR')} €
                          </div>
                          <div className="text-sm text-muted-foreground w-12 text-right">
                            {cat.percentage}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Facteurs */}
                {estimation.factors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Facteurs d'ajustement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {estimation.factors.map((factor, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span>{factor.name}</span>
                            <Badge variant={factor.impact === 'increase' ? 'destructive' : 'default'}>
                              {factor.impact === 'increase' ? '+' : '-'}{Math.abs(factor.percentage)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Avertissements */}
                {estimation.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {estimation.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </TabsContent>

          {/* Onglet Documents */}
          <TabsContent value="documents" className="space-y-6">
            {/* Actions de génération */}
            <Card>
              <CardHeader>
                <CardTitle>Générer des documents</CardTitle>
                <CardDescription>
                  Créez les documents nécessaires pour votre consultation d'entreprises
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => generateDocument('ccf')}
                    disabled={isGeneratingDoc}
                  >
                    {isGeneratingDoc ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileCheck className="w-4 h-4 mr-2" />
                    )}
                    Générer CCF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateDocument('aps')}
                    disabled={isGeneratingDoc}
                  >
                    <FileOutput className="w-4 h-4 mr-2" />
                    Générer APS
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateDocument('cctp')}
                    disabled={isGeneratingDoc}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Générer CCTP
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Liste des documents */}
            {documents.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Documents générés</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-primary" />
                          <div>
                            <div className="font-medium">{doc.title}</div>
                            <div className="text-sm text-muted-foreground">
                              Version {doc.metadata.version} • {new Date(doc.generatedAt).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={doc.status === 'final' ? 'default' : 'secondary'}>
                            {doc.status === 'final' ? 'Finalisé' : 'Brouillon'}
                          </Badge>
                          <Button variant="ghost" size="icon" onClick={() => exportDocument(doc)}>
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Printer className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun document</h3>
                  <p className="text-muted-foreground mb-4">
                    Générez vos premiers documents pour votre projet
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Phase0ProjectPage;
