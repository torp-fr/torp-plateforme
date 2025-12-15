/**
 * RoomWorkEditor - Éditeur de travaux par pièce
 * Permet de définir les travaux pièce par pièce avec photos et notes
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Plus,
  Trash2,
  Camera,
  Image,
  FileText,
  Edit,
  Check,
  X,
  ChevronRight,
  Home,
  Bed,
  Bath,
  ChefHat,
  Sofa,
  Car,
  Stairs,
  DoorOpen,
  MoreHorizontal,
  Euro,
  Clock,
  Ruler,
  AlertCircle,
  Upload,
} from 'lucide-react';
import type {
  RoomWorkDefinition,
  RoomWork,
  RoomPhoto,
  RoomNote,
  RoomType,
  RoomWorkCategory,
  RoomWorkType,
  FinishLevel,
  WorkPriority,
} from '@/types/phase0';
import {
  ROOM_TYPE_CONFIGS,
  ROOM_WORK_CATEGORY_LABELS,
  ROOM_WORK_TYPE_LABELS,
  FINISH_LEVEL_LABELS,
  WORK_PRIORITY_LABELS,
} from '@/types/phase0';

// =============================================================================
// TYPES
// =============================================================================

interface RoomWorkEditorProps {
  rooms: RoomWorkDefinition[];
  onRoomsChange: (rooms: RoomWorkDefinition[]) => void;
  projectId: string;
  isReadOnly?: boolean;
}

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (room: Partial<RoomWorkDefinition>) => void;
}

interface AddWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (work: Partial<RoomWork>) => void;
  roomType: RoomType;
}

// =============================================================================
// ICÔNES PAR TYPE DE PIÈCE
// =============================================================================

const ROOM_ICONS: Record<RoomType, React.ReactNode> = {
  living_room: <Sofa className="h-5 w-5" />,
  dining_room: <Home className="h-5 w-5" />,
  bedroom: <Bed className="h-5 w-5" />,
  bathroom: <Bath className="h-5 w-5" />,
  shower_room: <Bath className="h-5 w-5" />,
  toilet: <Bath className="h-5 w-5" />,
  kitchen: <ChefHat className="h-5 w-5" />,
  office: <Home className="h-5 w-5" />,
  laundry: <Home className="h-5 w-5" />,
  dressing: <Home className="h-5 w-5" />,
  storage: <Home className="h-5 w-5" />,
  cellar: <Stairs className="h-5 w-5" />,
  attic: <Home className="h-5 w-5" />,
  garage: <Car className="h-5 w-5" />,
  workshop: <Home className="h-5 w-5" />,
  veranda: <Home className="h-5 w-5" />,
  entrance: <DoorOpen className="h-5 w-5" />,
  hallway: <Home className="h-5 w-5" />,
  staircase: <Stairs className="h-5 w-5" />,
  utility: <Home className="h-5 w-5" />,
  other: <MoreHorizontal className="h-5 w-5" />,
};

// =============================================================================
// TRAVAUX PAR CATÉGORIE DE PIÈCE
// =============================================================================

const WORKS_BY_CATEGORY: Record<RoomWorkCategory, RoomWorkType[]> = {
  demolition: ['floor_demolition', 'wall_demolition'],
  gros_oeuvre: ['wall_creation', 'wall_opening'],
  sol: ['floor_leveling', 'floor_screed', 'floor_tile', 'floor_parquet', 'floor_laminate', 'floor_vinyl', 'floor_carpet', 'floor_concrete', 'floor_epoxy', 'floor_heated'],
  mur: ['wall_plastering', 'wall_painting', 'wall_wallpaper', 'wall_tiling', 'wall_paneling', 'wall_insulation'],
  plafond: ['ceiling_false', 'ceiling_painting', 'ceiling_plaster', 'ceiling_acoustic'],
  menuiserie: ['door_interior', 'door_exterior', 'window_replacement', 'window_renovation', 'shutter_install', 'closet_builtin'],
  electricite: ['elec_renovation', 'elec_outlets', 'elec_lighting', 'elec_switches', 'elec_panel', 'elec_network'],
  plomberie: ['plumb_supply', 'plumb_drain', 'plumb_fixture', 'plumb_heating'],
  chauffage: ['heat_radiator', 'heat_underfloor', 'heat_towel'],
  ventilation: ['vent_vmc', 'vent_extraction', 'vent_grille'],
  isolation: ['wall_insulation'],
  agencement: ['kitchen_layout', 'bathroom_layout', 'storage_custom', 'dressing_custom'],
  decoration: ['wall_painting', 'wall_wallpaper'],
  equipement: ['equip_sink', 'equip_toilet', 'equip_shower', 'equip_bathtub', 'equip_washbasin', 'equip_appliance'],
};

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function RoomWorkEditor({
  rooms,
  onRoomsChange,
  projectId,
  isReadOnly = false,
}: RoomWorkEditorProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    rooms.length > 0 ? rooms[0].id : null
  );
  const [addRoomDialogOpen, setAddRoomDialogOpen] = useState(false);
  const [addWorkDialogOpen, setAddWorkDialogOpen] = useState(false);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // Ajouter une pièce
  const handleAddRoom = useCallback((roomData: Partial<RoomWorkDefinition>) => {
    const newRoom: RoomWorkDefinition = {
      id: `room_${Date.now()}`,
      projectId,
      room: {
        name: roomData.room?.name || 'Nouvelle pièce',
        type: roomData.room?.type || 'other',
        level: roomData.room?.level || 0,
        surface: roomData.room?.surface || 10,
        ceilingHeight: roomData.room?.ceilingHeight || 2.5,
        hasWindow: roomData.room?.hasWindow ?? true,
        windowCount: roomData.room?.windowCount || 1,
        hasWetArea: roomData.room?.hasWetArea || false,
        hasElectricity: roomData.room?.hasElectricity ?? true,
      },
      plannedWorks: [],
      photos: [],
      notes: [],
      currentState: {
        overallCondition: 'average',
        floorCondition: 'average',
        wallsCondition: 'average',
        ceilingCondition: 'average',
        doorsCondition: 'average',
        windowsCondition: 'average',
      },
      targetState: {
        overallCondition: 'good',
        floorCondition: 'good',
        wallsCondition: 'good',
        ceilingCondition: 'good',
        doorsCondition: 'good',
        windowsCondition: 'good',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedRooms = [...rooms, newRoom];
    onRoomsChange(updatedRooms);
    setSelectedRoomId(newRoom.id);
    setAddRoomDialogOpen(false);
  }, [rooms, onRoomsChange, projectId]);

  // Supprimer une pièce
  const handleDeleteRoom = useCallback((roomId: string) => {
    const updatedRooms = rooms.filter(r => r.id !== roomId);
    onRoomsChange(updatedRooms);
    if (selectedRoomId === roomId) {
      setSelectedRoomId(updatedRooms.length > 0 ? updatedRooms[0].id : null);
    }
  }, [rooms, onRoomsChange, selectedRoomId]);

  // Ajouter un travail
  const handleAddWork = useCallback((workData: Partial<RoomWork>) => {
    if (!selectedRoom) return;

    const newWork: RoomWork = {
      id: `work_${Date.now()}`,
      roomId: selectedRoom.id,
      workCategory: workData.workCategory || 'sol',
      workType: workData.workType || 'floor_painting',
      title: workData.title || ROOM_WORK_TYPE_LABELS[workData.workType || 'floor_painting'] || 'Nouveau travail',
      description: workData.description,
      specifications: {
        surfaceArea: selectedRoom.room.surface,
        finishLevel: 'standard',
      },
      associatedLots: [],
      priority: 'medium',
      isOptional: false,
      photosBefore: [],
      status: 'draft',
    };

    const updatedRoom = {
      ...selectedRoom,
      plannedWorks: [...selectedRoom.plannedWorks, newWork],
      updatedAt: new Date().toISOString(),
    };

    const updatedRooms = rooms.map(r => r.id === selectedRoom.id ? updatedRoom : r);
    onRoomsChange(updatedRooms);
    setAddWorkDialogOpen(false);
  }, [selectedRoom, rooms, onRoomsChange]);

  // Supprimer un travail
  const handleDeleteWork = useCallback((workId: string) => {
    if (!selectedRoom) return;

    const updatedRoom = {
      ...selectedRoom,
      plannedWorks: selectedRoom.plannedWorks.filter(w => w.id !== workId),
      updatedAt: new Date().toISOString(),
    };

    const updatedRooms = rooms.map(r => r.id === selectedRoom.id ? updatedRoom : r);
    onRoomsChange(updatedRooms);
  }, [selectedRoom, rooms, onRoomsChange]);

  // Mettre à jour un travail
  const handleUpdateWork = useCallback((workId: string, updates: Partial<RoomWork>) => {
    if (!selectedRoom) return;

    const updatedRoom = {
      ...selectedRoom,
      plannedWorks: selectedRoom.plannedWorks.map(w =>
        w.id === workId ? { ...w, ...updates } : w
      ),
      updatedAt: new Date().toISOString(),
    };

    const updatedRooms = rooms.map(r => r.id === selectedRoom.id ? updatedRoom : r);
    onRoomsChange(updatedRooms);
  }, [selectedRoom, rooms, onRoomsChange]);

  // Ajouter une note
  const handleAddNote = useCallback((content: string) => {
    if (!selectedRoom || !content.trim()) return;

    const newNote: RoomNote = {
      id: `note_${Date.now()}`,
      roomId: selectedRoom.id,
      content: content.trim(),
      noteType: 'observation',
      importance: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      includeInCCTP: true,
      includeInDCE: true,
    };

    const updatedRoom = {
      ...selectedRoom,
      notes: [...selectedRoom.notes, newNote],
      updatedAt: new Date().toISOString(),
    };

    const updatedRooms = rooms.map(r => r.id === selectedRoom.id ? updatedRoom : r);
    onRoomsChange(updatedRooms);
  }, [selectedRoom, rooms, onRoomsChange]);

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden bg-background">
      {/* Sidebar - Liste des pièces */}
      <div className="w-64 border-r bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Pièces</h3>
            <Badge variant="secondary">{rooms.length}</Badge>
          </div>
          {!isReadOnly && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => setAddRoomDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une pièce
            </Button>
          )}
        </div>

        <ScrollArea className="h-[calc(100%-80px)]">
          <div className="p-2 space-y-1">
            {rooms.map(room => {
              const config = ROOM_TYPE_CONFIGS[room.room.type];
              const worksCount = room.plannedWorks.length;
              const photosCount = room.photos.length;

              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedRoomId === room.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0">
                      {ROOM_ICONS[room.room.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {room.room.customName || room.room.name}
                      </div>
                      <div className={`text-xs ${
                        selectedRoomId === room.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}>
                        {room.room.surface} m² • {worksCount} travaux
                      </div>
                    </div>
                    {photosCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Camera className="h-3 w-3 mr-1" />
                        {photosCount}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}

            {rooms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune pièce définie</p>
                <p className="text-xs">Cliquez sur "Ajouter une pièce"</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Contenu principal - Détails de la pièce */}
      <div className="flex-1 overflow-hidden">
        {selectedRoom ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* En-tête de la pièce */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    {ROOM_ICONS[selectedRoom.room.type]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {selectedRoom.room.customName || selectedRoom.room.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {ROOM_TYPE_CONFIGS[selectedRoom.room.type]?.label} •{' '}
                      {selectedRoom.room.surface} m² •{' '}
                      Niveau {selectedRoom.room.level === 0 ? 'RDC' : selectedRoom.room.level}
                    </p>
                  </div>
                </div>
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteRoom(selectedRoom.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Separator />

              {/* Travaux prévus */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Travaux prévus
                  </h3>
                  {!isReadOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddWorkDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un travail
                    </Button>
                  )}
                </div>

                {selectedRoom.plannedWorks.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {selectedRoom.plannedWorks.map(work => (
                      <AccordionItem
                        key={work.id}
                        value={work.id}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <Badge variant="outline">
                              {ROOM_WORK_CATEGORY_LABELS[work.workCategory]}
                            </Badge>
                            <span className="font-medium">{work.title}</span>
                            {work.specifications.surfaceArea && (
                              <span className="text-sm text-muted-foreground">
                                ({work.specifications.surfaceArea} m²)
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-4 space-y-4">
                            {work.description && (
                              <p className="text-sm text-muted-foreground">
                                {work.description}
                              </p>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Niveau de finition
                                </Label>
                                <Select
                                  value={work.specifications.finishLevel}
                                  onValueChange={(value: FinishLevel) =>
                                    handleUpdateWork(work.id, {
                                      specifications: {
                                        ...work.specifications,
                                        finishLevel: value,
                                      },
                                    })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(FINISH_LEVEL_LABELS).map(([key, label]) => (
                                      <SelectItem key={key} value={key}>
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Priorité
                                </Label>
                                <Select
                                  value={work.priority}
                                  onValueChange={(value: WorkPriority) =>
                                    handleUpdateWork(work.id, { priority: value })
                                  }
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(WORK_PRIORITY_LABELS).map(([key, label]) => (
                                      <SelectItem key={key} value={key}>
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {!isReadOnly && (
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleDeleteWork(work.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </Button>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aucun travail défini pour cette pièce
                      </p>
                      {!isReadOnly && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setAddWorkDialogOpen(true)}
                        >
                          Ajouter le premier travail
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              {/* Photos */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Photos
                  </h3>
                  {!isReadOnly && (
                    <Button size="sm" variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Ajouter des photos
                    </Button>
                  )}
                </div>

                {selectedRoom.photos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {selectedRoom.photos.map(photo => (
                      <div
                        key={photo.id}
                        className="aspect-square rounded-lg overflow-hidden border bg-muted"
                      >
                        <img
                          src={photo.thumbnailUrl || photo.url}
                          alt={photo.title || 'Photo'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Image className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aucune photo pour cette pièce
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Les photos enrichissent le DCE et aident les entreprises
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              {/* Notes */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4" />
                  Notes et observations
                </h3>

                {selectedRoom.notes.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {selectedRoom.notes.map(note => (
                      <div
                        key={note.id}
                        className="p-3 border rounded-lg bg-muted/30"
                      >
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {!isReadOnly && (
                  <NoteInput onAdd={handleAddNote} />
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Sélectionnez une pièce pour voir les détails</p>
              {!isReadOnly && rooms.length === 0 && (
                <Button
                  className="mt-4"
                  onClick={() => setAddRoomDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter votre première pièce
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddRoomDialog
        open={addRoomDialogOpen}
        onOpenChange={setAddRoomDialogOpen}
        onAdd={handleAddRoom}
      />

      {selectedRoom && (
        <AddWorkDialog
          open={addWorkDialogOpen}
          onOpenChange={setAddWorkDialogOpen}
          onAdd={handleAddWork}
          roomType={selectedRoom.room.type}
        />
      )}
    </div>
  );
}

// =============================================================================
// COMPOSANTS AUXILIAIRES
// =============================================================================

function AddRoomDialog({ open, onOpenChange, onAdd }: AddRoomDialogProps) {
  const [roomType, setRoomType] = useState<RoomType>('bedroom');
  const [customName, setCustomName] = useState('');
  const [surface, setSurface] = useState('12');
  const [level, setLevel] = useState('0');

  const handleSubmit = () => {
    const config = ROOM_TYPE_CONFIGS[roomType];
    onAdd({
      room: {
        name: customName || config.label,
        customName: customName || undefined,
        type: roomType,
        level: parseInt(level, 10),
        surface: parseFloat(surface) || config.defaultSurface,
        ceilingHeight: 2.5,
        hasWindow: true,
        windowCount: 1,
        hasWetArea: config.hasWetArea,
        hasElectricity: true,
      },
    });
    // Reset form
    setRoomType('bedroom');
    setCustomName('');
    setSurface('12');
    setLevel('0');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une pièce</DialogTitle>
          <DialogDescription>
            Définissez les caractéristiques de la pièce à ajouter
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Type de pièce</Label>
            <Select value={roomType} onValueChange={(v) => setRoomType(v as RoomType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROOM_TYPE_CONFIGS).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    <span className="flex items-center gap-2">
                      {ROOM_ICONS[type as RoomType]}
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nom personnalisé (optionnel)</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={`Ex: ${ROOM_TYPE_CONFIGS[roomType].label} 1`}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Surface (m²)</Label>
              <Input
                type="number"
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                placeholder="12"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Niveau</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">Sous-sol</SelectItem>
                  <SelectItem value="0">RDC</SelectItem>
                  <SelectItem value="1">1er étage</SelectItem>
                  <SelectItem value="2">2ème étage</SelectItem>
                  <SelectItem value="3">3ème étage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit}>Ajouter la pièce</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddWorkDialog({ open, onOpenChange, onAdd, roomType }: AddWorkDialogProps) {
  const [category, setCategory] = useState<RoomWorkCategory>('sol');
  const [workType, setWorkType] = useState<RoomWorkType>('floor_parquet');
  const [description, setDescription] = useState('');

  // Travaux suggérés selon le type de pièce
  const suggestedWorks = ROOM_TYPE_CONFIGS[roomType]?.typicalWorks || [];

  const handleSubmit = () => {
    onAdd({
      workCategory: category,
      workType,
      title: ROOM_WORK_TYPE_LABELS[workType],
      description: description || undefined,
    });
    // Reset
    setCategory('sol');
    setWorkType('floor_parquet');
    setDescription('');
  };

  // Mettre à jour le type de travail quand la catégorie change
  const handleCategoryChange = (newCategory: RoomWorkCategory) => {
    setCategory(newCategory);
    const availableWorks = WORKS_BY_CATEGORY[newCategory];
    if (availableWorks && availableWorks.length > 0) {
      setWorkType(availableWorks[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un travail</DialogTitle>
          <DialogDescription>
            Définissez le type de travail à effectuer dans cette pièce
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Suggestions rapides */}
          {suggestedWorks.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Travaux suggérés pour ce type de pièce
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestedWorks.slice(0, 4).map(wt => (
                  <Button
                    key={wt}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Trouver la catégorie de ce type de travail
                      const cat = Object.entries(WORKS_BY_CATEGORY).find(([, works]) =>
                        works.includes(wt)
                      );
                      if (cat) {
                        setCategory(cat[0] as RoomWorkCategory);
                        setWorkType(wt);
                      }
                    }}
                    className={workType === wt ? 'border-primary' : ''}
                  >
                    {ROOM_WORK_TYPE_LABELS[wt]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <Label>Catégorie</Label>
            <Select
              value={category}
              onValueChange={(v) => handleCategoryChange(v as RoomWorkCategory)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROOM_WORK_CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Type de travail</Label>
            <Select
              value={workType}
              onValueChange={(v) => setWorkType(v as RoomWorkType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKS_BY_CATEGORY[category]?.map(wt => (
                  <SelectItem key={wt} value={wt}>
                    {ROOM_WORK_TYPE_LABELS[wt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description (optionnel)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails supplémentaires sur ce travail..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit}>Ajouter le travail</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteInput({ onAdd }: { onAdd: (content: string) => void }) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      onAdd(content);
      setContent('');
    }
  };

  return (
    <div className="flex gap-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ajouter une note ou observation..."
        rows={2}
        className="flex-1"
      />
      <Button
        onClick={handleSubmit}
        disabled={!content.trim()}
        className="self-end"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default RoomWorkEditor;
