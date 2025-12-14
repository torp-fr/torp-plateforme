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
import { AppLayout } from '@/components/layout';
import {
  ArrowLeft, Edit, FileText, Download, RefreshCw, User, Building, MapPin,
  Hammer, Euro, Calendar, Clock, AlertTriangle, Loader2, CheckCircle2,
  FileCheck, FileOutput, Printer, Share2, FileSearch, ArrowRight, Send,
  Briefcase, FileSpreadsheet, Eye, ExternalLink, Users2, HardHat
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
  PDFExportService,
} from '@/services/phase0';
import { DocumentViewer } from '@/components/phase0';
import { TenderService } from '@/services/tender/tender.service';
import { DCEGeneratorService } from '@/services/tender/dce-generator.service';
import type { Tender, TenderDocument as TenderDoc } from '@/types/tender';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';

export function Phase0ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { labels } = useProfile();

  const [project, setProject] = useState<Phase0Project | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [estimation, setEstimation] = useState<ProjectEstimation | null>(null);
  const [tender, setTender] = useState<Tender | null>(null);
  const [tenderDocuments, setTenderDocuments] = useState<TenderDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [isGeneratingAO, setIsGeneratingAO] = useState(false);
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

        // Charger l'AO existant si le projet en a un
        if (projectData.status === 'in_consultation' || projectData.status === 'validated') {
          try {
            const tenders = await TenderService.listByUser(projectData.userId);
            const projectTender = tenders.find(t => t.id && projectData.id);
            // Charger le tender complet si trouvé via le project
            const { data: tenderData } = await supabase
              .from('tenders')
              .select('*')
              .eq('phase0_project_id', projectData.id)
              .single();

            if (tenderData) {
              const fullTender = await TenderService.getById(tenderData.id);
              if (fullTender) {
                setTender(fullTender);
                setTenderDocuments(fullTender.dceDocuments || []);
              }
            }
          } catch (tenderErr) {
            console.log('Pas d\'AO existant pour ce projet');
          }
        }
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

  // Exporter un document (legacy - maintenant géré par DocumentViewer)
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

  // Rafraîchir la liste des documents
  const refreshDocuments = useCallback(async () => {
    if (!projectId) return;
    try {
      const projectDocs = await DocumentGeneratorService.getProjectDocuments(projectId);
      setDocuments(projectDocs);
    } catch (err) {
      console.error('Erreur rafraîchissement documents:', err);
    }
  }, [projectId]);

  // Générer un appel d'offres depuis le projet Phase 0
  const generateAO = useCallback(async () => {
    if (!project) return;

    setIsGeneratingAO(true);
    try {
      // 1. Créer l'AO depuis le projet Phase 0
      const newTender = await TenderService.createFromPhase0(project);

      // 2. Générer le DCE complet
      const dceResult = await DCEGeneratorService.generateDCE(newTender, project);

      if (dceResult.errors.length > 0) {
        toast({
          title: 'Appel d\'offres créé avec avertissements',
          description: `${dceResult.documents.length} documents générés. ${dceResult.errors.length} erreur(s)`,
        });
      } else {
        toast({
          title: 'Appel d\'offres créé',
          description: `DCE complet généré avec ${dceResult.documents.length} documents (RC, CCTP, DPGF, Planning, AE)`,
        });
      }

      setTender(dceResult.tender);
      setTenderDocuments(dceResult.documents);

      // Mettre à jour le projet local
      setProject(prev => prev ? { ...prev, status: 'in_consultation' } : null);

    } catch (err) {
      console.error('Erreur génération AO:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer l\'appel d\'offres',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAO(false);
    }
  }, [project, toast]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !project) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || 'Projet non trouvé'}</AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/phase0/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux projets
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusConfig = PHASE0_STATUS_CONFIG[project.status];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link to="/phase0/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {labels.projectNamePlural}
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
            <Button variant="outline" onClick={() => navigate(`/phase0/project/${project.id}/analyze`)}>
              <FileSearch className="w-4 h-4 mr-2" />
              {labels.analyzeLabel}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/phase1/project/${project.id}`)}>
              <Users2 className="w-4 h-4 mr-2" />
              {labels.consultationLabel}
            </Button>
            {(project.status === 'in_consultation' || project.status === 'validated') && (
              <Button onClick={() => navigate(`/phase2/${project.id}`)}>
                <HardHat className="w-4 h-4 mr-2" />
                Chantier
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
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
                <div className="text-2xl font-bold text-primary">{project.completeness?.overall || 0}%</div>
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
            <TabsTrigger value="tender" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Appel d'Offres
              {tender && <Badge variant="secondary" className="ml-1 text-xs">{tender.status}</Badge>}
            </TabsTrigger>
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
                  {(() => {
                    // Support both ownerProfile (new) and owner (legacy)
                    const owner = project.ownerProfile || project.owner;
                    const identity = owner?.identity;
                    const contact = owner?.contact;
                    const isB2C = identity?.type?.toLowerCase() === 'b2c';
                    return (
                      <>
                        <div>
                          <span className="text-muted-foreground">Profil: </span>
                          <span className="font-medium">
                            {isB2C ? 'Particulier' : 'Professionnel'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contact: </span>
                          <span className="font-medium">
                            {isB2C
                              ? `${identity?.firstName || ''} ${identity?.lastName || ''}`.trim() || 'Non renseigné'
                              : identity?.companyName || 'Non renseigné'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email: </span>
                          <span>{contact?.email || 'Non renseigné'}</span>
                        </div>
                      </>
                    );
                  })()}
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
                  Créez les documents nécessaires pour votre {labels.consultationLabel.toLowerCase()}
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

            {/* Visualiseur de documents avec UX adaptée au profil */}
            <DocumentViewer
              documents={documents}
              projectTitle={project.workProject?.general?.title || 'Projet'}
              projectReference={project.reference}
              onRefresh={refreshDocuments}
              isLoading={isGeneratingDoc}
            />
          </TabsContent>

          {/* Onglet Appel d'Offres */}
          <TabsContent value="tender" className="space-y-6">
            {!tender ? (
              /* Pas encore d'AO - Proposer de le générer */
              <Card className="border-2 border-dashed border-primary/30">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Send className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Créer un appel d'offres</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Transformez votre projet en appel d'offres professionnel. Le DCE complet sera généré automatiquement
                    (RC, CCTP, DPGF, Planning, Acte d'Engagement).
                  </p>

                  <div className="flex flex-col items-center gap-4">
                    <Button
                      size="lg"
                      onClick={generateAO}
                      disabled={isGeneratingAO || !project?.selectedLots?.length}
                      className="px-8"
                    >
                      {isGeneratingAO ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Génération en cours...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Générer l'Appel d'Offres
                        </>
                      )}
                    </Button>

                    {!project?.selectedLots?.length && (
                      <Alert variant="destructive" className="max-w-md">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Vous devez sélectionner au moins un lot de travaux pour créer un appel d'offres.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Separator className="my-6 w-full max-w-md" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <FileText className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="font-medium">Documents générés</p>
                      <p className="text-muted-foreground">RC, CCTP, DPGF, AE</p>
                    </div>
                    <div>
                      <Briefcase className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="font-medium">Diffusion</p>
                      <p className="text-muted-foreground">Privé ou public</p>
                    </div>
                    <div>
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="font-medium">Réponses</p>
                      <p className="text-muted-foreground">Scoring TORP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* AO existant - Afficher les détails */
              <>
                {/* En-tête de l'AO */}
                <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-mono">
                            {tender.reference}
                          </Badge>
                          <Badge variant={
                            tender.status === 'published' ? 'default' :
                            tender.status === 'draft' || tender.status === 'ready' ? 'secondary' :
                            tender.status === 'attributed' ? 'default' : 'outline'
                          }>
                            {tender.status === 'draft' && 'Brouillon'}
                            {tender.status === 'ready' && 'Prêt à publier'}
                            {tender.status === 'published' && 'Publié'}
                            {tender.status === 'closed' && 'Fermé'}
                            {tender.status === 'evaluation' && 'En évaluation'}
                            {tender.status === 'attributed' && 'Attribué'}
                            {tender.status === 'cancelled' && 'Annulé'}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl">{tender.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {tender.lotsCount} lot(s) • Créé le {tender.createdAt.toLocaleDateString('fr-FR')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => navigate(`/tenders/${tender.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Voir détails
                        </Button>
                        <Button onClick={() => navigate(`/tenders/${tender.id}`)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Gérer l'AO
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Statistiques */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Entreprises invitées</div>
                      <div className="text-2xl font-bold">{tender.invitedCount}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Vues</div>
                      <div className="text-2xl font-bold">{tender.viewsCount}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Téléchargements</div>
                      <div className="text-2xl font-bold">{tender.downloadsCount}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Réponses</div>
                      <div className="text-2xl font-bold text-primary">{tender.responsesCount}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Documents DCE générés */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      Dossier de Consultation (DCE)
                    </CardTitle>
                    <CardDescription>
                      Documents générés automatiquement depuis votre projet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tenderDocuments.length > 0 ? (
                      <div className="space-y-3">
                        {tenderDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{doc.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {doc.documentType.toUpperCase()} • Version {doc.version}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {doc.isAutoGenerated ? 'Auto-généré' : 'Manuel'}
                              </Badge>
                              <Button variant="ghost" size="icon">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Documents DCE en cours de génération...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {tender.status === 'ready' && (
                        <Button onClick={() => navigate(`/tenders/${tender.id}`)}>
                          <Send className="w-4 h-4 mr-2" />
                          Publier l'appel d'offres
                        </Button>
                      )}
                      {tender.status === 'published' && (
                        <Button variant="outline" onClick={() => navigate(`/tenders/${tender.id}/responses`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Voir les réponses ({tender.responsesCount})
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => navigate(`/tenders/${tender.id}`)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier l'AO
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default Phase0ProjectPage;
