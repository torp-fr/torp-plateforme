/**
 * TORP Phase 2 - Composant AdministrativeChecklist
 * Checklist administrative interactive pour préparation chantier
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText,
  Shield,
  Building,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HardHat,
  ScrollText,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { useChecklistState } from '@/hooks/phase2/useChecklistState';
import type { ChecklistItem } from '@/types/phase2';

interface AdministrativeChecklistProps {
  chantierId: string;
  onComplete?: () => void;
  onItemClick?: (item: ChecklistItem) => void;
  readOnly?: boolean;
  className?: string;
}

// Icons par catégorie
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Documents administratifs': FileText,
  'Assurances': Shield,
  'Sécurité': AlertTriangle,
  'Installation chantier': HardHat,
  'Documents techniques': ScrollText,
  'Contrat': FileCheck,
  'default': Building,
};

// Couleurs par catégorie
const CATEGORY_COLORS: Record<string, string> = {
  'Documents administratifs': 'border-l-blue-500',
  'Assurances': 'border-l-green-500',
  'Sécurité': 'border-l-red-500',
  'Installation chantier': 'border-l-orange-500',
  'Documents techniques': 'border-l-purple-500',
  'Contrat': 'border-l-indigo-500',
  'default': 'border-l-gray-500',
};

export function AdministrativeChecklist({
  chantierId,
  onComplete,
  onItemClick,
  readOnly = false,
  className,
}: AdministrativeChecklistProps) {
  const {
    checklist,
    progress,
    completedCount,
    totalCount,
    isReadyToStart,
    requiredMissing,
    byCategory,
    isLoading,
    isUpdating,
    updateItem,
    validateItem,
    invalidateItem,
    addComment,
    attachDocument,
    validateChecklist,
  } = useChecklistState(chantierId);

  // State pour les catégories dépliées
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set(Object.keys(byCategory))
  );

  // State pour le dialog d'upload
  const [uploadDialog, setUploadDialog] = React.useState<{
    open: boolean;
    item: ChecklistItem | null;
  }>({ open: false, item: null });

  // State pour le dialog de commentaire
  const [commentDialog, setCommentDialog] = React.useState<{
    open: boolean;
    item: ChecklistItem | null;
    comment: string;
  }>({ open: false, item: null, comment: '' });

  // Stats par catégorie
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {};
    Object.entries(byCategory).forEach(([category, items]) => {
      stats[category] = {
        total: items.length,
        completed: items.filter(i => i.valide).length,
      };
    });
    return stats;
  }, [byCategory]);

  // Handlers
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleItemToggle = (item: ChecklistItem) => {
    if (readOnly) return;
    if (item.valide) {
      invalidateItem(item.id);
    } else {
      validateItem(item.id);
    }
  };

  const handleOpenUpload = (item: ChecklistItem) => {
    setUploadDialog({ open: true, item });
  };

  const handleUploadDocument = (url: string) => {
    if (uploadDialog.item) {
      attachDocument(uploadDialog.item.id, url);
      setUploadDialog({ open: false, item: null });
    }
  };

  const handleOpenComment = (item: ChecklistItem) => {
    setCommentDialog({
      open: true,
      item,
      comment: item.commentaire || '',
    });
  };

  const handleSaveComment = () => {
    if (commentDialog.item) {
      addComment(commentDialog.item.id, commentDialog.comment);
      setCommentDialog({ open: false, item: null, comment: '' });
    }
  };

  const handleValidateAll = async () => {
    await validateChecklist();
    onComplete?.();
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header avec progression */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Checklist de démarrage
          </CardTitle>
          <CardDescription>
            Vérifiez tous les éléments avant le démarrage du chantier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Barre de progression */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progression</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCount} ({progress}%)
              </span>
            </div>
            <Progress value={progress} className="h-3" />

            {/* Statut */}
            <div className="flex items-center justify-between pt-2">
              {isReadyToStart ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Chantier prêt à démarrer</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">En préparation</span>
                </div>
              )}

              {isReadyToStart && !readOnly && (
                <Button onClick={handleValidateAll} disabled={isUpdating}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Valider la checklist
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Éléments obligatoires manquants */}
      {requiredMissing.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{requiredMissing.length} élément(s) obligatoire(s) manquant(s)</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {requiredMissing.slice(0, 5).map(item => (
                <li key={item.id} className="text-sm">{item.libelle}</li>
              ))}
              {requiredMissing.length > 5 && (
                <li className="text-sm">...et {requiredMissing.length - 5} autre(s)</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Catégories */}
      {Object.entries(byCategory).map(([category, items]) => {
        const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['default'];
        const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS['default'];
        const stats = categoryStats[category];
        const isExpanded = expandedCategories.has(category);
        const isComplete = stats.completed === stats.total;

        return (
          <Card key={category} className={`border-l-4 ${colorClass}`}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Icon className="h-5 w-5" />
                      {category}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isComplete ? 'default' : 'outline'}
                        className={isComplete ? 'bg-green-500' : ''}
                      >
                        {stats.completed}/{stats.total}
                      </Badge>
                      {isComplete && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          item.valide
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white hover:bg-muted/20'
                        }`}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={item.valide}
                          onCheckedChange={() => handleItemToggle(item)}
                          disabled={readOnly || isUpdating}
                          className="mt-0.5"
                        />

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`${
                                item.valide ? 'line-through text-muted-foreground' : ''
                              }`}>
                                {item.libelle}
                              </span>
                              {item.obligatoire && (
                                <Badge variant="destructive" className="text-xs h-5">
                                  Obligatoire
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Commentaire */}
                          {item.commentaire && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.commentaire}
                            </p>
                          )}

                          {/* Date de validation */}
                          {item.dateValidation && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Validé le {new Date(item.dateValidation).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Document */}
                          {item.documentUrl ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              asChild
                            >
                              <a
                                href={item.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 text-blue-500" />
                              </a>
                            </Button>
                          ) : !readOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleOpenUpload(item)}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Commentaire */}
                          {!readOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleOpenComment(item)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Dialog Upload Document */}
      <Dialog open={uploadDialog.open} onOpenChange={(open) => setUploadDialog({ open, item: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Joindre un document</DialogTitle>
            <DialogDescription>
              {uploadDialog.item?.libelle}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">URL du document</label>
              <Input
                placeholder="https://..."
                className="mt-1"
                onChange={(e) => {
                  // In real app, this would handle file upload
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Collez l'URL du document ou uploadez un fichier
              </p>
            </div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Glissez-déposez un fichier ici
              </p>
              <Button variant="outline" size="sm" className="mt-2">
                Parcourir
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog({ open: false, item: null })}>
              Annuler
            </Button>
            <Button onClick={() => handleUploadDocument('#document-url')}>
              Joindre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Commentaire */}
      <Dialog open={commentDialog.open} onOpenChange={(open) => setCommentDialog({ open, item: null, comment: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un commentaire</DialogTitle>
            <DialogDescription>
              {commentDialog.item?.libelle}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Textarea
              placeholder="Votre commentaire..."
              value={commentDialog.comment}
              onChange={(e) => setCommentDialog(prev => ({ ...prev, comment: e.target.value }))}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialog({ open: false, item: null, comment: '' })}>
              Annuler
            </Button>
            <Button onClick={handleSaveComment}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdministrativeChecklist;
