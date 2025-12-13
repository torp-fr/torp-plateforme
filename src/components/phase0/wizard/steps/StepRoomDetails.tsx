/**
 * Étape 2.5 - Détails des pièces et travaux
 * Permet de définir les travaux pièce par pièce avec photos et notes
 */

import React, { useState, useMemo, useEffect } from 'react';
import { StepComponentProps } from '../WizardContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { PricingEstimationService, ProjectEstimation } from '@/services/phase0/pricing-estimation.service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  Camera,
  StickyNote,
  Home,
  Bed,
  UtensilsCrossed,
  Bath,
  Sofa,
  MoreVertical,
  ChevronRight,
  Hammer,
  Paintbrush,
  Wrench,
  Lightbulb,
  Thermometer,
  Euro,
  AlertCircle,
  CheckCircle2,
  Copy,
  Edit,
  Image,
  TrendingUp,
  TrendingDown,
  Calculator,
  Info,
  BarChart3,
} from 'lucide-react';
import {
  RoomType,
  RoomDetail,
  RoomWorkItem,
  WorkItemType,
  ROOM_TYPE_CONFIG,
  WORK_ITEM_CONFIG,
  createEmptyRoom,
  createWorkItem,
  RoomDetailsData,
} from '@/types/phase0/room-details.types';

// =============================================================================
// ICONS MAPPING
// =============================================================================

const ROOM_ICONS: Partial<Record<RoomType, React.ReactNode>> = {
  living_room: <Sofa className="w-5 h-5" />,
  bedroom: <Bed className="w-5 h-5" />,
  kitchen: <UtensilsCrossed className="w-5 h-5" />,
  bathroom: <Bath className="w-5 h-5" />,
  toilet: <Bath className="w-4 h-4" />,
  hallway: <Home className="w-5 h-5" />,
  office: <Home className="w-5 h-5" />,
  other: <Home className="w-5 h-5" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  coating: <Paintbrush className="w-4 h-4" />,
  woodwork: <Hammer className="w-4 h-4" />,
  plumbing: <Wrench className="w-4 h-4" />,
  electrical: <Lightbulb className="w-4 h-4" />,
  hvac: <Thermometer className="w-4 h-4" />,
  equipment: <Home className="w-4 h-4" />,
  exterior: <Home className="w-4 h-4" />,
  structure: <Hammer className="w-4 h-4" />,
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddRoom: (type: RoomType, customName?: string) => void;
  existingRooms: RoomDetail[];
}

function AddRoomDialog({ open, onOpenChange, onAddRoom, existingRooms }: AddRoomDialogProps) {
  const [selectedType, setSelectedType] = useState<RoomType | null>(null);
  const [customName, setCustomName] = useState('');

  const handleAdd = () => {
    if (selectedType) {
      onAddRoom(selectedType, customName || undefined);
      setSelectedType(null);
      setCustomName('');
      onOpenChange(false);
    }
  };

  // Compter les pièces existantes par type pour suggérer un nom
  const getCountForType = (type: RoomType) => {
    return existingRooms.filter(r => r.type === type).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une pièce</DialogTitle>
          <DialogDescription>
            Sélectionnez le type de pièce concernée par des travaux
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4">
          {(Object.entries(ROOM_TYPE_CONFIG) as [RoomType, typeof ROOM_TYPE_CONFIG[RoomType]][]).map(([type, config]) => {
            const count = getCountForType(type);
            const isSelected = selectedType === type;

            return (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setCustomName(count > 0 ? `${config.label} ${count + 1}` : '');
                }}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                  }
                `}
              >
                <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                  {ROOM_ICONS[type] || <Home className="w-5 h-5" />}
                </span>
                <span className="text-sm font-medium">{config.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {count} déjà
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {selectedType && (
          <div className="space-y-2">
            <Label htmlFor="customName">Nom personnalisé (optionnel)</Label>
            <Input
              id="customName"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={ROOM_TYPE_CONFIG[selectedType].label}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleAdd} disabled={!selectedType}>
            Ajouter la pièce
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RoomCardProps {
  room: RoomDetail;
  onUpdate: (room: RoomDetail) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isExpanded: boolean;
}

function RoomCard({ room, onUpdate, onDelete, onDuplicate, isExpanded }: RoomCardProps) {
  const config = ROOM_TYPE_CONFIG[room.type];

  // Grouper les travaux par catégorie
  const worksByCategory = useMemo(() => {
    const groups: Record<string, typeof WORK_ITEM_CONFIG[WorkItemType][]> = {};
    Object.entries(WORK_ITEM_CONFIG).forEach(([type, cfg]) => {
      if (!groups[cfg.category]) groups[cfg.category] = [];
      groups[cfg.category].push({ ...cfg, type: type as WorkItemType });
    });
    return groups;
  }, []);

  const handleToggleWork = (workType: WorkItemType) => {
    const existingIndex = room.works.findIndex(w => w.type === workType);
    let newWorks: RoomWorkItem[];

    if (existingIndex >= 0) {
      newWorks = room.works.filter((_, i) => i !== existingIndex);
    } else {
      newWorks = [...room.works, createWorkItem(workType)];
    }

    onUpdate({
      ...room,
      works: newWorks,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleWorkDescriptionChange = (workId: string, description: string) => {
    onUpdate({
      ...room,
      works: room.works.map(w =>
        w.id === workId ? { ...w, description } : w
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const hasWork = (type: WorkItemType) => room.works.some(w => w.type === type);

  const categoryLabels: Record<string, string> = {
    coating: 'Revêtements',
    woodwork: 'Menuiserie',
    plumbing: 'Plomberie',
    electrical: 'Électricité',
    hvac: 'Chauffage/Ventilation',
    equipment: 'Équipements',
    exterior: 'Extérieur',
    structure: 'Structure',
  };

  return (
    <AccordionItem value={room.id} className="border rounded-lg mb-4">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-primary">
            {ROOM_ICONS[room.type] || <Home className="w-5 h-5" />}
          </span>
          <div className="flex-1 text-left">
            <div className="font-medium">{room.customName || config.label}</div>
            <div className="text-sm text-muted-foreground">
              {room.works.length > 0
                ? `${room.works.length} travaux sélectionnés`
                : 'Aucun travaux sélectionné'
              }
              {room.surface && ` • ${room.surface} m²`}
            </div>
          </div>
          {room.works.length > 0 && (
            <Badge variant="default" className="mr-2">
              {room.works.length}
            </Badge>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-6">
          {/* Actions rapides */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Surface (m²)"
                type="number"
                value={room.surface || ''}
                onChange={(e) => onUpdate({
                  ...room,
                  surface: e.target.value ? Number(e.target.value) : undefined,
                  updatedAt: new Date().toISOString(),
                })}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">m²</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  Dupliquer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Sélection des travaux par catégorie */}
          <div className="space-y-4">
            <Label className="text-base">Travaux à réaliser</Label>
            <p className="text-sm text-muted-foreground">
              Cochez les travaux concernés. Plus vous êtes précis, meilleure sera l'analyse.
            </p>

            {Object.entries(worksByCategory).map(([category, items]) => {
              // Ne montrer que les catégories pertinentes pour ce type de pièce
              const relevantItems = items.filter(item =>
                config.commonWorks.includes(item.type as WorkItemType) ||
                hasWork(item.type as WorkItemType)
              );

              if (relevantItems.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    {CATEGORY_ICONS[category]}
                    <span>{categoryLabels[category]}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {relevantItems.map((item) => {
                      const isChecked = hasWork(item.type as WorkItemType);
                      const workItem = room.works.find(w => w.type === item.type);

                      return (
                        <div
                          key={item.type}
                          className={`
                            flex items-start gap-3 p-3 rounded-lg border transition-all
                            ${isChecked ? 'border-primary bg-primary/5' : 'border-muted'}
                          `}
                        >
                          <Checkbox
                            id={`${room.id}-${item.type}`}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleWork(item.type as WorkItemType)}
                          />
                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={`${room.id}-${item.type}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {item.label}
                            </label>
                            {isChecked && workItem && (
                              <Input
                                placeholder="Précisions (ex: parquet chêne massif)"
                                value={workItem.description}
                                onChange={(e) => handleWorkDescriptionChange(workItem.id, e.target.value)}
                                className="mt-2 text-sm"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Bouton pour voir plus de travaux */}
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Voir plus de types de travaux
            </Button>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor={`notes-${room.id}`}>Notes et précisions</Label>
            <Textarea
              id={`notes-${room.id}`}
              value={room.notes || ''}
              onChange={(e) => onUpdate({
                ...room,
                notes: e.target.value,
                updatedAt: new Date().toISOString(),
              })}
              placeholder="Ex: Fenêtre double vitrage côté rue, attention aux moulures au plafond..."
              rows={3}
            />
          </div>

          {/* Photos (placeholder - nécessite intégration Supabase Storage) */}
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Ajoutez des photos pour aider les artisans à mieux comprendre vos besoins
              </p>
              <Button variant="outline" size="sm" disabled>
                <Image className="w-4 h-4 mr-2" />
                Ajouter des photos (bientôt disponible)
              </Button>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StepRoomDetails({
  project,
  answers,
  onAnswerChange,
  onAnswersChange,
  isProcessing,
}: StepComponentProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<string[]>([]);

  // Récupérer les données existantes
  const roomDetailsData: RoomDetailsData = useMemo(() => {
    const existing = (project.roomDetails || answers['roomDetails']) as RoomDetailsData | undefined;
    return existing || { rooms: [] };
  }, [project.roomDetails, answers]);

  const rooms = roomDetailsData.rooms;

  // Mise à jour des données
  const updateRoomDetails = (newData: RoomDetailsData) => {
    onAnswerChange('roomDetails', newData);
  };

  // Ajouter une pièce
  const handleAddRoom = (type: RoomType, customName?: string) => {
    const count = rooms.filter(r => r.type === type).length;
    const newRoom = createEmptyRoom(type, count);
    if (customName) newRoom.customName = customName;

    const newRooms = [...rooms, newRoom];
    updateRoomDetails({ ...roomDetailsData, rooms: newRooms });

    // Ouvrir automatiquement la nouvelle pièce
    setExpandedRooms(prev => [...prev, newRoom.id]);
  };

  // Mettre à jour une pièce
  const handleUpdateRoom = (roomId: string, updatedRoom: RoomDetail) => {
    const newRooms = rooms.map(r => r.id === roomId ? updatedRoom : r);
    updateRoomDetails({ ...roomDetailsData, rooms: newRooms });
  };

  // Supprimer une pièce
  const handleDeleteRoom = (roomId: string) => {
    const newRooms = rooms.filter(r => r.id !== roomId);
    updateRoomDetails({ ...roomDetailsData, rooms: newRooms });
    setExpandedRooms(prev => prev.filter(id => id !== roomId));
  };

  // Dupliquer une pièce
  const handleDuplicateRoom = (room: RoomDetail) => {
    const count = rooms.filter(r => r.type === room.type).length;
    const config = ROOM_TYPE_CONFIG[room.type];
    const newRoom: RoomDetail = {
      ...room,
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customName: `${config.label} ${count + 1}`,
      photos: [], // Ne pas dupliquer les photos
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newRooms = [...rooms, newRoom];
    updateRoomDetails({ ...roomDetailsData, rooms: newRooms });
    setExpandedRooms(prev => [...prev, newRoom.id]);
  };

  // Récupérer le code postal depuis le projet
  const postalCode = useMemo(() => {
    const property = project.property as Record<string, unknown> | undefined;
    const address = property?.address as Record<string, unknown> | undefined;
    return (address?.postalCode as string) || (answers['property.address.postalCode'] as string);
  }, [project.property, answers]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    const totalWorks = rooms.reduce((sum, r) => sum + r.works.length, 0);
    const roomsWithWorks = rooms.filter(r => r.works.length > 0).length;
    const totalSurface = rooms.reduce((sum, r) => sum + (r.surface || 0), 0);

    return { totalWorks, roomsWithWorks, totalSurface };
  }, [rooms]);

  // Calculer l'estimation tarifaire
  const estimation = useMemo((): ProjectEstimation | null => {
    if (rooms.length === 0 || stats.totalWorks === 0) return null;

    return PricingEstimationService.estimateProjectCost(roomDetailsData, {
      postalCode,
      complexity: 'standard',
      finishLevel: 'standard',
      contingencyPercentage: 10,
    });
  }, [roomDetailsData, rooms, stats.totalWorks, postalCode]);

  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="text-center max-w-2xl mx-auto">
        <Home className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Détaillez vos travaux par pièce</h2>
        <p className="text-muted-foreground">
          Plus vous êtes précis, plus les devis des artisans seront pertinents.
          Ajoutez les pièces concernées par des travaux et sélectionnez les interventions souhaitées.
        </p>
      </div>

      {/* Statistiques et Estimation */}
      {rooms.length > 0 && (
        <div className="space-y-4">
          {/* Stats rapides */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{rooms.length}</div>
                  <div className="text-sm text-muted-foreground">Pièce(s)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{stats.totalWorks}</div>
                  <div className="text-sm text-muted-foreground">Travaux</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {stats.totalSurface > 0 ? `${stats.totalSurface} m²` : '-'}
                  </div>
                  <div className="text-sm text-muted-foreground">Surface</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estimation tarifaire */}
          {estimation && stats.totalWorks > 0 && (
            <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="w-5 h-5 text-green-600" />
                  Estimation budgétaire
                </CardTitle>
                <CardDescription>
                  Basée sur les prix du marché {postalCode ? `(${postalCode})` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fourchette de prix */}
                <div className="text-center py-4 bg-white/50 dark:bg-black/20 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Estimation totale</div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                    {PricingEstimationService.formatPriceRange(
                      estimation.total.min,
                      estimation.total.max
                    )}
                  </div>
                  {estimation.pricePerSqm && stats.totalSurface > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      soit {PricingEstimationService.formatPriceRange(
                        estimation.pricePerSqm.min,
                        estimation.pricePerSqm.max
                      )} / m²
                    </div>
                  )}
                </div>

                {/* Benchmark marché */}
                {estimation.benchmarkComparison && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        Position marché
                      </span>
                      <Badge
                        variant={
                          estimation.benchmarkComparison.marketPosition === 'below'
                            ? 'secondary'
                            : estimation.benchmarkComparison.marketPosition === 'above'
                            ? 'default'
                            : 'outline'
                        }
                        className="flex items-center gap-1"
                      >
                        {estimation.benchmarkComparison.marketPosition === 'below' && (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {estimation.benchmarkComparison.marketPosition === 'above' && (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {estimation.benchmarkComparison.marketPosition === 'below'
                          ? 'Sous la moyenne'
                          : estimation.benchmarkComparison.marketPosition === 'above'
                          ? 'Au-dessus de la moyenne'
                          : 'Dans la moyenne'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Moyenne régionale</span>
                        <span className="font-medium">
                          {PricingEstimationService.formatPrice(estimation.benchmarkComparison.regionalAverage)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Moyenne nationale</span>
                        <span className="font-medium">
                          {PricingEstimationService.formatPrice(estimation.benchmarkComparison.nationalAverage)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground border-l-2 border-green-300 pl-3">
                      {estimation.benchmarkComparison.message}
                    </p>
                  </div>
                )}

                {/* Détail par pièce */}
                {estimation.rooms.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="text-sm font-medium">Détail par pièce</div>
                    {estimation.rooms.map((room) => (
                      <div key={room.roomId} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {room.roomName}
                          {room.surface && <span className="ml-1">({room.surface} m²)</span>}
                        </span>
                        <span className="font-medium">
                          {PricingEstimationService.formatPriceRange(
                            room.totalEstimate.min,
                            room.totalEstimate.max
                          )}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Provision imprévus ({estimation.contingency.percentage}%)</span>
                      <span className="font-medium">
                        {PricingEstimationService.formatPriceRange(
                          estimation.contingency.min,
                          estimation.contingency.max
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Niveau de confiance */}
                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Info className="w-3 h-3" />
                    Niveau de confiance: {
                      estimation.confidence === 'high' ? 'Élevé' :
                      estimation.confidence === 'medium' ? 'Moyen' : 'Indicatif'
                    }
                  </span>
                  <span className="text-muted-foreground">
                    Valide jusqu'au {new Date(estimation.validUntil).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Liste des pièces */}
      {rooms.length > 0 ? (
        <Accordion
          type="multiple"
          value={expandedRooms}
          onValueChange={setExpandedRooms}
          className="space-y-4"
        >
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onUpdate={(updatedRoom) => handleUpdateRoom(room.id, updatedRoom)}
              onDelete={() => handleDeleteRoom(room.id)}
              onDuplicate={() => handleDuplicateRoom(room)}
              isExpanded={expandedRooms.includes(room.id)}
            />
          ))}
        </Accordion>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Home className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune pièce ajoutée</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Commencez par ajouter les pièces de votre bien qui sont concernées par des travaux.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une pièce
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bouton ajouter */}
      {rooms.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={isProcessing}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une autre pièce
          </Button>
        </div>
      )}

      {/* Notes globales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            Notes générales sur le projet
          </CardTitle>
          <CardDescription>
            Informations complémentaires pour les artisans (accès au chantier, contraintes particulières...)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={roomDetailsData.globalNotes || ''}
            onChange={(e) => updateRoomDetails({
              ...roomDetailsData,
              globalNotes: e.target.value,
            })}
            placeholder="Ex: Parking difficile, immeuble avec gardien, travaux uniquement le week-end..."
            rows={4}
            disabled={isProcessing}
          />
        </CardContent>
      </Card>

      {/* Information */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-700 dark:text-blue-300">Conseil</p>
          <p className="text-blue-600 dark:text-blue-400">
            Ces informations détaillées permettront à TORP d'analyser vos devis en contexte
            et de détecter les anomalies ou oublis potentiels.
          </p>
        </div>
      </div>

      {/* Dialog ajouter pièce */}
      <AddRoomDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddRoom={handleAddRoom}
        existingRooms={rooms}
      />
    </div>
  );
}

export default StepRoomDetails;
