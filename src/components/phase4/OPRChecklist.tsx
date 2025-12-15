/**
 * OPRChecklist - Checklist de contrôle par lot
 * Points de vérification avec statut et commentaires
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Camera,
  ChevronDown,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOPR } from '@/hooks/phase4/useOPR';
import type { OPRControle } from '@/types/phase4.types';

interface OPRChecklistProps {
  sessionId: string;
  controles: OPRControle[];
  disabled?: boolean;
}

const STATUT_CONFIG = {
  conforme: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-50',
    label: 'Conforme',
  },
  non_conforme: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    label: 'Non conforme',
  },
  reserve: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    label: 'Réserve',
  },
  non_applicable: {
    icon: HelpCircle,
    color: 'text-gray-400',
    bg: 'bg-gray-50',
    label: 'N/A',
  },
  non_verifie: {
    icon: HelpCircle,
    color: 'text-gray-300',
    bg: 'bg-white',
    label: 'Non vérifié',
  },
};

export function OPRChecklist({ sessionId, controles, disabled }: OPRChecklistProps) {
  const { updateControle } = useOPR({ chantierId: '' }); // Hook pour les mutations
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedControle, setSelectedControle] = useState<OPRControle | null>(null);
  const [comment, setComment] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Grouper les contrôles par lot
  const controlesByLot = controles.reduce((acc, c) => {
    const lot = c.lot || 'Autre';
    if (!acc[lot]) acc[lot] = [];
    acc[lot].push(c);
    return acc;
  }, {} as Record<string, OPRControle[]>);

  // Filtrer par recherche
  const filteredLots = Object.entries(controlesByLot).filter(([lot, items]) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      lot.toLowerCase().includes(term) ||
      items.some(
        (c) =>
          c.point.toLowerCase().includes(term) ||
          c.categorie.toLowerCase().includes(term)
      )
    );
  });

  // Statistiques par lot
  const getLotStats = (items: OPRControle[]) => {
    const total = items.length;
    const verified = items.filter((c) => c.statut !== 'non_verifie').length;
    const conformes = items.filter((c) => c.statut === 'conforme').length;
    const issues = items.filter((c) =>
      ['non_conforme', 'reserve'].includes(c.statut)
    ).length;
    return { total, verified, conformes, issues };
  };

  const handleStatusChange = (controleId: string, statut: OPRControle['statut']) => {
    if (disabled) return;
    updateControle({
      sessionId,
      controleId,
      update: { statut },
    });
  };

  const handleSaveComment = () => {
    if (!selectedControle || disabled) return;
    updateControle({
      sessionId,
      controleId: selectedControle.id,
      update: {
        statut: selectedControle.statut,
        commentaire: comment,
      },
    });
    setShowDetails(false);
    setSelectedControle(null);
    setComment('');
  };

  const openDetails = (controle: OPRControle) => {
    setSelectedControle(controle);
    setComment(controle.commentaire || '');
    setShowDetails(true);
  };

  // Statistiques globales
  const globalStats = {
    total: controles.length,
    verified: controles.filter((c) => c.statut !== 'non_verifie').length,
    conformes: controles.filter((c) => c.statut === 'conforme').length,
    nonConformes: controles.filter((c) => c.statut === 'non_conforme').length,
    reserves: controles.filter((c) => c.statut === 'reserve').length,
  };

  const progressPercent = globalStats.total > 0
    ? Math.round((globalStats.verified / globalStats.total) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Barre de progression et stats */}
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span>Progression</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{globalStats.conformes}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span>{globalStats.reserves}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>{globalStats.nonConformes}</span>
          </div>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un point de contrôle..."
          className="pl-10"
        />
      </div>

      {/* Liste par lot */}
      <Accordion type="multiple" className="space-y-2">
        {filteredLots.map(([lot, items]) => {
          const stats = getLotStats(items);
          const lotProgress = stats.total > 0
            ? Math.round((stats.verified / stats.total) * 100)
            : 0;

          return (
            <AccordionItem key={lot} value={lot} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium capitalize">
                      {lot.replace(/_/g, ' ')}
                    </span>
                    <Badge variant="outline">
                      {stats.verified}/{stats.total}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {stats.issues > 0 && (
                      <Badge variant="destructive">{stats.issues} problème(s)</Badge>
                    )}
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${lotProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {/* Grouper par catégorie */}
                {Object.entries(
                  items.reduce((acc, c) => {
                    const cat = c.categorie || 'Général';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(c);
                    return acc;
                  }, {} as Record<string, OPRControle[]>)
                ).map(([categorie, catItems]) => (
                  <div key={categorie} className="mb-4">
                    <h5 className="text-sm font-medium text-muted-foreground mb-2">
                      {categorie}
                    </h5>
                    <div className="space-y-2">
                      {catItems.map((controle) => {
                        const config = STATUT_CONFIG[controle.statut];
                        const Icon = config.icon;

                        return (
                          <div
                            key={controle.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border',
                              config.bg,
                              disabled && 'opacity-60'
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <Icon className={cn('h-5 w-5', config.color)} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{controle.point}</span>
                                  {controle.obligatoire && (
                                    <Badge variant="outline" className="text-xs">
                                      Obligatoire
                                    </Badge>
                                  )}
                                </div>
                                {controle.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {controle.description}
                                  </p>
                                )}
                                {controle.commentaire && (
                                  <p className="text-sm italic text-muted-foreground mt-1">
                                    "{controle.commentaire}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {!disabled && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      controle.statut === 'conforme' && 'bg-green-100'
                                    )}
                                    onClick={() =>
                                      handleStatusChange(controle.id, 'conforme')
                                    }
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      controle.statut === 'reserve' && 'bg-orange-100'
                                    )}
                                    onClick={() =>
                                      handleStatusChange(controle.id, 'reserve')
                                    }
                                  >
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      controle.statut === 'non_conforme' && 'bg-red-100'
                                    )}
                                    onClick={() =>
                                      handleStatusChange(controle.id, 'non_conforme')
                                    }
                                  >
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDetails(controle)}
                                  >
                                    <Camera className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {filteredLots.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Aucun point de contrôle trouvé
        </div>
      )}

      {/* Dialog détails */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedControle?.point}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedControle?.description && (
              <p className="text-sm text-muted-foreground">
                {selectedControle.description}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Commentaire / Observation</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                rows={3}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Photos</label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={disabled}>
                  <Camera className="h-4 w-4 mr-2" />
                  Ajouter photo
                </Button>
              </div>
              {selectedControle?.photos && selectedControle.photos.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {selectedControle.photos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveComment} disabled={disabled}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
