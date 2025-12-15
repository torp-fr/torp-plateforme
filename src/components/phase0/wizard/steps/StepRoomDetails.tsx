/**
 * Étape 3 - Type de travaux et détails par pièce (fusionnée)
 * Permet de définir le type de projet et les travaux pièce par pièce
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  ChevronDown,
  Hammer,
  Paintbrush,
  Wrench,
  Lightbulb,
  Thermometer,
  ThermometerSun,
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
  Grid3X3,
  Layers,
  Droplets,
  Zap,
  Fan,
  DoorOpen,
  Fence,
  Trees,
  Warehouse,
  Building2,
  Square,
  Tv,
  ShowerHead,
  AirVent,
  Flame,
  Plug,
  Cable,
  Blinds,
  PaintBucket,
  CircleDot,
  Laptop,
  Briefcase,
  Shirt,
  Baby,
  Gamepad2,
  Wine,
  Car,
  Flower2,
  Sun,
  Shield,
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
import { WorkType } from '@/types/phase0/work-project.types';

// =============================================================================
// WORK TYPE OPTIONS (fusionné depuis StepWorkIntent)
// =============================================================================

const WORK_TYPE_OPTIONS: Array<{
  value: WorkType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'renovation',
    label: 'Rénovation',
    description: 'Rénover ou moderniser un bien existant',
    icon: <Hammer className="w-6 h-6" />,
  },
  {
    value: 'refurbishment',
    label: 'Réhabilitation',
    description: 'Remettre aux normes un bien dégradé',
    icon: <Wrench className="w-6 h-6" />,
  },
  {
    value: 'extension',
    label: 'Extension',
    description: 'Agrandir la surface habitable',
    icon: <Building2 className="w-6 h-6" />,
  },
  {
    value: 'improvement',
    label: 'Amélioration',
    description: 'Améliorer le confort ou l\'énergie',
    icon: <ThermometerSun className="w-6 h-6" />,
  },
  {
    value: 'new_construction',
    label: 'Construction neuve',
    description: 'Construire un nouveau bâtiment',
    icon: <Home className="w-6 h-6" />,
  },
  {
    value: 'maintenance',
    label: 'Entretien',
    description: 'Travaux d\'entretien courant',
    icon: <Shield className="w-6 h-6" />,
  },
];

// =============================================================================
// ICONS MAPPING
// =============================================================================

const ROOM_ICONS: Record<RoomType, React.ReactNode> = {
  living_room: <Sofa className="w-6 h-6" />,
  bedroom: <Bed className="w-6 h-6" />,
  kitchen: <UtensilsCrossed className="w-6 h-6" />,
  bathroom: <Bath className="w-6 h-6" />,
  toilet: <ShowerHead className="w-6 h-6" />,
  hallway: <DoorOpen className="w-6 h-6" />,
  office: <Laptop className="w-6 h-6" />,
  laundry: <Droplets className="w-6 h-6" />,
  garage: <Car className="w-6 h-6" />,
  basement: <Warehouse className="w-6 h-6" />,
  attic: <Building2 className="w-6 h-6" />,
  balcony: <Sun className="w-6 h-6" />,
  terrace: <Trees className="w-6 h-6" />,
  other: <Grid3X3 className="w-6 h-6" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  coating: <Paintbrush className="w-4 h-4" />,
  woodwork: <DoorOpen className="w-4 h-4" />,
  plumbing: <Droplets className="w-4 h-4" />,
  electrical: <Zap className="w-4 h-4" />,
  hvac: <Thermometer className="w-4 h-4" />,
  equipment: <Tv className="w-4 h-4" />,
  exterior: <Trees className="w-4 h-4" />,
  structure: <Building2 className="w-4 h-4" />,
};

// Icons par type de travaux pour l'affichage illustré
const WORK_ICONS: Partial<Record<WorkItemType, React.ReactNode>> = {
  // Revêtements
  painting: <PaintBucket className="w-5 h-5" />,
  flooring: <Layers className="w-5 h-5" />,
  tiling: <Grid3X3 className="w-5 h-5" />,
  wallpaper: <Blinds className="w-5 h-5" />,
  parquet: <Square className="w-5 h-5" />,
  // Menuiserie
  doors: <DoorOpen className="w-5 h-5" />,
  windows: <Square className="w-5 h-5" />,
  closets: <Shirt className="w-5 h-5" />,
  kitchen_furniture: <UtensilsCrossed className="w-5 h-5" />,
  bathroom_furniture: <Bath className="w-5 h-5" />,
  // Plomberie
  plumbing_fixtures: <ShowerHead className="w-5 h-5" />,
  water_heater: <Flame className="w-5 h-5" />,
  pipes: <Droplets className="w-5 h-5" />,
  // Électricité
  electrical_outlets: <Plug className="w-5 h-5" />,
  lighting: <Lightbulb className="w-5 h-5" />,
  electrical_panel: <Zap className="w-5 h-5" />,
  network_wiring: <Cable className="w-5 h-5" />,
  // CVC
  heating: <Flame className="w-5 h-5" />,
  air_conditioning: <AirVent className="w-5 h-5" />,
  ventilation: <Fan className="w-5 h-5" />,
  insulation: <Thermometer className="w-5 h-5" />,
  // Équipements
  appliances: <Tv className="w-5 h-5" />,
  smart_home: <Laptop className="w-5 h-5" />,
  // Extérieur
  fencing: <Fence className="w-5 h-5" />,
  landscaping: <Flower2 className="w-5 h-5" />,
  // Structure
  demolition: <Hammer className="w-5 h-5" />,
  masonry: <Building2 className="w-5 h-5" />,
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
  const [showAllWorks, setShowAllWorks] = useState(false);

  // Grouper les travaux par catégorie
  const worksByCategory = useMemo(() => {
    const groups: Record<string, (typeof WORK_ITEM_CONFIG[WorkItemType] & { type: WorkItemType })[]> = {};
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

          {/* Sélection des travaux avec boutons illustrés */}
          <div className="space-y-4">
            <Label className="text-base">Travaux à réaliser</Label>
            <p className="text-sm text-muted-foreground">
              Cliquez sur les travaux concernés. Plus vous êtes précis, meilleure sera l'analyse.
            </p>

            {/* Travaux courants pour ce type de pièce - Affichage en grille de boutons */}
            <div className="space-y-4">
              {Object.entries(worksByCategory).map(([category, items]) => {
                // Filtrer selon le mode (courant ou tous)
                const relevantItems = showAllWorks
                  ? items
                  : items.filter(item =>
                      config.commonWorks.includes(item.type as WorkItemType) ||
                      hasWork(item.type as WorkItemType)
                    );

                if (relevantItems.length === 0) return null;

                return (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      {CATEGORY_ICONS[category]}
                      <span>{categoryLabels[category]}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {relevantItems.map((item) => {
                        const isSelected = hasWork(item.type);
                        const workItem = room.works.find(w => w.type === item.type);

                        return (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => handleToggleWork(item.type)}
                            className={`
                              flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center
                              ${isSelected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                              }
                            `}
                          >
                            <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                              {WORK_ICONS[item.type] || CATEGORY_ICONS[category] || <Hammer className="w-5 h-5" />}
                            </span>
                            <span className="text-xs font-medium leading-tight">{item.label}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-primary absolute -top-1 -right-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bouton pour voir plus/moins de travaux */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAllWorks(!showAllWorks)}
            >
              {showAllWorks ? (
                <>
                  <ChevronDown className="w-4 h-4 mr-2 rotate-180" />
                  Afficher moins
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Voir tous les types de travaux
                </>
              )}
            </Button>

            {/* Descriptions des travaux sélectionnés */}
            {room.works.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-sm">Précisions sur les travaux sélectionnés</Label>
                {room.works.map((work) => {
                  const workConfig = WORK_ITEM_CONFIG[work.type];
                  return (
                    <div key={work.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <span className="text-primary mt-0.5">
                        {WORK_ICONS[work.type] || <Hammer className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 space-y-2">
                        <div className="font-medium text-sm">{workConfig?.label || work.type}</div>
                        <Input
                          placeholder="Précisions (ex: parquet chêne massif, peinture blanche mate...)"
                          value={work.description}
                          onChange={(e) => handleWorkDescriptionChange(work.id, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleToggleWork(work.type)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
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

  // Récupérer les données du projet de travaux
  const workProject = (project.workProject || {}) as Record<string, unknown>;
  const scope = (workProject.scope || {}) as Record<string, unknown>;
  const general = (workProject.general || {}) as Record<string, unknown>;

  // Type de travaux sélectionné (chemin correct: workProject.general.projectType)
  const workType = (general.projectType as WorkType) || (answers['workProject.general.projectType'] as WorkType);
  const projectTitle = (general.title as string) || (answers['workProject.general.title'] as string) || '';
  const projectDescription = (general.description as string) || (answers['workProject.general.description'] as string) || '';

  // Récupérer les données existantes des pièces
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

  // Récupérer le code postal depuis le projet (chemin correct: property.identification.address)
  const postalCode = useMemo(() => {
    const property = project.property as Record<string, unknown> | undefined;
    const identification = property?.identification as Record<string, unknown> | undefined;
    const address = identification?.address as Record<string, unknown> | undefined;
    return (address?.postalCode as string) || (answers['property.identification.address.postalCode'] as string);
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
    <div className="space-y-4">
      {/* Section 1: Type de projet - Compact */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hammer className="w-4 h-4 text-primary" />
            Type de projet
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {WORK_TYPE_OPTIONS.map((option) => {
              const isSelected = workType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAnswerChange('workProject.general.projectType', option.value)}
                  disabled={isProcessing}
                  className={`
                    flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-center
                    ${isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-primary/50'
                    }
                  `}
                >
                  <span className={`${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                    {React.cloneElement(option.icon as React.ReactElement, { className: 'w-5 h-5' })}
                  </span>
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>

          {/* Titre et description du projet - Compact */}
          {workType && (
            <div className="mt-4 space-y-3 pt-3 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="projectTitle" className="text-xs">Titre du projet (optionnel)</Label>
                  <Input
                    id="projectTitle"
                    value={projectTitle}
                    onChange={(e) => onAnswerChange('workProject.general.title', e.target.value)}
                    placeholder="Ex: Rénovation appartement"
                    disabled={isProcessing}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="projectDescription" className="text-xs">Description (optionnel)</Label>
                  <Input
                    id="projectDescription"
                    value={projectDescription}
                    onChange={(e) => onAnswerChange('workProject.general.description', e.target.value)}
                    placeholder="Ex: Remplacement 3 fenêtres vétustes"
                    disabled={isProcessing}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Détails par pièce - visible uniquement après sélection du type */}
      {/* Statistiques et Estimation */}
      {workType && rooms.length > 0 && (
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
      {workType && rooms.length > 0 ? (
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
      ) : workType && rooms.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Détails par pièce (recommandé)
            </CardTitle>
            <CardDescription>
              Cliquez sur les pièces concernées par des travaux. Plus vous êtes précis, meilleurs seront les devis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
              {(Object.entries(ROOM_TYPE_CONFIG) as [RoomType, typeof ROOM_TYPE_CONFIG[RoomType]][]).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => handleAddRoom(type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-muted hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">
                    {ROOM_ICONS[type]}
                  </span>
                  <span className="text-xs font-medium text-center leading-tight">{config.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Bouton ajouter */}
      {workType && rooms.length > 0 && (
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
      {workType && (
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
      )}

      {/* Information */}
      {workType && (
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
      )}

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
