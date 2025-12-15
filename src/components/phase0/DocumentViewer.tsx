/**
 * DocumentViewer - Visualiseur de documents Phase 0
 * Affiche les documents générés avec une UX adaptée au profil utilisateur
 * Gamification : progression, badges, statuts visuels
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText, Download, Eye, CheckCircle2, Clock,
  BookOpen, ChevronRight, ChevronDown, Award,
  RefreshCw, Loader2
} from 'lucide-react';
import { GeneratedDocument, DocumentSection, DocumentType } from '@/services/phase0/documentGenerator.service';
import { PDFExportService } from '@/services/phase0/pdfExport.service';
import { useApp, UserType } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

// Configuration par profil
const PROFILE_CONFIG: Record<UserType, {
  documentLabels: Record<DocumentType, { title: string; description: string; icon: string }>;
  showTechnicalDetails: boolean;
  gamificationLevel: 'simple' | 'standard' | 'advanced';
}> = {
  B2C: {
    documentLabels: {
      ccf: { title: 'Cahier des charges', description: 'Description de votre projet', icon: '📋' },
      aps: { title: 'Avant-projet', description: 'Résumé et estimations', icon: '📊' },
      cctp: { title: 'Descriptif technique', description: 'Détails des travaux', icon: '🔧' },
    },
    showTechnicalDetails: false,
    gamificationLevel: 'simple',
  },
  B2B: {
    documentLabels: {
      ccf: { title: 'CCF - Cahier des Charges Fonctionnel', description: 'Définition du besoin', icon: '📋' },
      aps: { title: 'APS - Avant-Projet Sommaire', description: 'Estimation budgétaire et planning', icon: '📊' },
      cctp: { title: 'CCTP - Clauses Techniques', description: 'Prescriptions techniques détaillées', icon: '🔧' },
    },
    showTechnicalDetails: true,
    gamificationLevel: 'standard',
  },
  B2G: {
    documentLabels: {
      ccf: { title: 'CCF', description: 'Cahier des Charges Fonctionnel', icon: '📋' },
      aps: { title: 'APS', description: 'Avant-Projet Sommaire', icon: '📊' },
      cctp: { title: 'CCTP', description: 'Cahier des Clauses Techniques Particulières', icon: '🔧' },
    },
    showTechnicalDetails: true,
    gamificationLevel: 'advanced',
  },
  admin: {
    documentLabels: {
      ccf: { title: 'CCF', description: 'Cahier des Charges Fonctionnel', icon: '📋' },
      aps: { title: 'APS', description: 'Avant-Projet Sommaire', icon: '📊' },
      cctp: { title: 'CCTP', description: 'CCTP', icon: '🔧' },
    },
    showTechnicalDetails: true,
    gamificationLevel: 'advanced',
  },
  super_admin: {
    documentLabels: {
      ccf: { title: 'CCF', description: 'Cahier des Charges Fonctionnel', icon: '📋' },
      aps: { title: 'APS', description: 'Avant-Projet Sommaire', icon: '📊' },
      cctp: { title: 'CCTP', description: 'CCTP', icon: '🔧' },
    },
    showTechnicalDetails: true,
    gamificationLevel: 'advanced',
  },
};

interface DocumentViewerProps {
  documents: GeneratedDocument[];
  projectTitle: string;
  projectReference: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DocumentViewer({
  documents,
  projectTitle,
  projectReference,
  onRefresh,
  isLoading = false,
}: DocumentViewerProps) {
  const { userType } = useApp();
  const { toast } = useToast();
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const config = PROFILE_CONFIG[userType];

  // Calculer la progression des documents
  const getDocumentProgress = () => {
    const requiredDocs = ['ccf', 'aps', 'cctp'];
    const generatedDocs = documents.map(d => d.type);
    const progress = (requiredDocs.filter(d => generatedDocs.includes(d as DocumentType)).length / requiredDocs.length) * 100;
    return Math.round(progress);
  };

  // Obtenir le statut visuel d'un document
  const getDocumentStatus = (doc: GeneratedDocument) => {
    switch (doc.status) {
      case 'final':
        return { label: 'Finalisé', color: 'bg-green-500', icon: CheckCircle2 };
      case 'archived':
        return { label: 'Archivé', color: 'bg-gray-400', icon: Clock };
      default:
        return { label: userType === 'B2C' ? 'Brouillon' : 'Draft', color: 'bg-blue-500', icon: FileText };
    }
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Export PDF
  const handleExportPDF = useCallback(async (doc: GeneratedDocument) => {
    setIsExporting(true);
    try {
      await PDFExportService.exportDocumentToPDF(doc, userType);
      toast({
        title: userType === 'B2C' ? 'Document téléchargé' : 'PDF exporté',
        description: `${doc.title} a été téléchargé avec succès`,
      });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [userType, toast]);

  // Export all documents
  const handleExportAll = useCallback(async () => {
    if (documents.length === 0) return;

    setIsExporting(true);
    try {
      await PDFExportService.exportAllDocumentsToPDF(documents, projectTitle, projectReference, userType);
      toast({
        title: 'Dossier complet téléchargé',
        description: `${documents.length} document(s) exporté(s)`,
      });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le dossier PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [documents, projectTitle, projectReference, userType, toast]);

  // Render section content
  const renderSection = (section: DocumentSection, depth = 0) => {
    const isExpanded = expandedSections.has(section.id);
    const hasSubsections = section.subsections && section.subsections.length > 0;

    return (
      <div key={section.id} className={`${depth > 0 ? 'ml-4 border-l-2 border-muted pl-4' : ''}`}>
        <div
          className={`flex items-start gap-2 py-2 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 ${
            depth === 0 ? 'font-semibold' : ''
          }`}
          onClick={() => hasSubsections && toggleSection(section.id)}
        >
          {hasSubsections && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground" />
            )
          )}
          {!hasSubsections && <div className="w-4" />}
          <div className="flex-1">
            <div className="text-sm">{section.title}</div>
            {section.content && (!hasSubsections || isExpanded) && (
              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {config.showTechnicalDetails
                  ? section.content
                  : section.content.substring(0, 200) + (section.content.length > 200 ? '...' : '')
                }
              </div>
            )}
          </div>
        </div>
        {hasSubsections && isExpanded && (
          <div className="mt-1">
            {section.subsections!.map(sub => renderSection(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Empty state
  if (documents.length === 0 && !isLoading) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {userType === 'B2C' ? 'Aucun document généré' : 'Aucun document'}
          </h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            {userType === 'B2C'
              ? 'Générez vos documents pour préparer votre projet de travaux'
              : 'Générez le DCE pour constituer votre dossier de consultation'
            }
          </p>
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec progression */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {userType === 'B2C' ? 'Vos documents' : 'Dossier de projet'}
              </CardTitle>
              <CardDescription className="mt-1">
                {documents.length} document(s) généré(s) pour {projectTitle}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {documents.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleExportAll}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {userType === 'B2C' ? 'Tout télécharger' : 'Exporter le dossier'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Barre de progression gamifiée */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {userType === 'B2C' ? 'Préparation du dossier' : 'Complétude du DCE'}
              </span>
              <span className="font-medium">{getDocumentProgress()}%</span>
            </div>
            <Progress value={getDocumentProgress()} className="h-2" />
            {getDocumentProgress() === 100 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Award className="w-4 h-4" />
                <span>
                  {userType === 'B2C'
                    ? 'Bravo ! Votre dossier est complet'
                    : 'DCE complet - Prêt pour la consultation'
                  }
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste des documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(doc => {
          const status = getDocumentStatus(doc);
          const StatusIcon = status.icon;
          const docConfig = config.documentLabels[doc.type] || {
            title: doc.type.toUpperCase(),
            description: 'Document',
            icon: '📄',
          };

          return (
            <Card
              key={doc.id}
              className="hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setSelectedDocument(doc)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{docConfig.icon}</div>
                    <div>
                      <CardTitle className="text-base">{docConfig.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {docConfig.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className={`${status.color} text-white text-xs`}>
                    {status.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Métadonnées */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Version</span>
                      <span className="font-medium">{doc.metadata.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Généré le</span>
                      <span className="font-medium">
                        {doc.metadata.generationDate?.toLocaleDateString?.('fr-FR') || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDocument(doc);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Consulter
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportPDF(doc);
                      }}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Placeholder pour documents manquants */}
        {['ccf', 'aps', 'cctp']
          .filter(type => !documents.some(d => d.type === type))
          .map(type => {
            const docConfig = config.documentLabels[type as DocumentType];
            return (
              <Card key={type} className="border-dashed opacity-60">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl opacity-50">{docConfig?.icon || '📄'}</div>
                    <div>
                      <CardTitle className="text-base text-muted-foreground">
                        {docConfig?.title || type.toUpperCase()}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Non généré
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                    <Clock className="w-4 h-4 mr-2" />
                    En attente de génération
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Modal de visualisation du document */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          {selectedDocument && (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      <span className="text-xl">
                        {config.documentLabels[selectedDocument.type]?.icon || '📄'}
                      </span>
                      {selectedDocument.title}
                    </DialogTitle>
                    <DialogDescription>
                      Version {selectedDocument.metadata.version} •
                      Généré le {selectedDocument.metadata.generationDate?.toLocaleDateString?.('fr-FR') || 'N/A'}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportPDF(selectedDocument)}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      Télécharger PDF
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <Separator className="flex-shrink-0 my-4" />

              {/* Contenu du document - défilement natif */}
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-4 pb-4">
                  {/* Informations du projet */}
                  <Card className="bg-muted/50">
                    <CardContent className="py-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Référence</div>
                          <div className="font-medium">{selectedDocument.metadata.projectReference}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Maître d'ouvrage</div>
                          <div className="font-medium">{selectedDocument.metadata.ownerName}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground">Adresse</div>
                          <div className="font-medium">{selectedDocument.metadata.propertyAddress}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sections du document */}
                  <div className="space-y-2">
                    {selectedDocument.content.sections.map(section => renderSection(section))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DocumentViewer;
