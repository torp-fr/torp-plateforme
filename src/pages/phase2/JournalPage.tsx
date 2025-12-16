/**
 * TORP Phase 2 - Journal de Chantier
 * Suivi quotidien des activités, effectifs, conditions et événements du chantier
 */

import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import {
  Calendar,
  Plus,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Thermometer,
  Users,
  Truck,
  AlertTriangle,
  Camera,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  HardHat,
  Wrench,
  Package,
  MessageSquare,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Shield,
  Activity
} from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// Types
interface JournalEntry {
  id: string;
  date: string;
  meteo: {
    condition: 'ensoleille' | 'nuageux' | 'pluie' | 'neige' | 'vent';
    temperature: number;
    intemperies: boolean;
    arretChantier: boolean;
  };
  effectifs: EffectifEntry[];
  activites: ActiviteEntry[];
  livraisons: LivraisonEntry[];
  incidents: IncidentEntry[];
  observations: string;
  photos: PhotoEntry[];
  securite: SecuriteEntry;
  validePar?: string;
  valideDate?: string;
  status: 'brouillon' | 'valide' | 'cloture';
}

interface EffectifEntry {
  id: string;
  entreprise: string;
  lot: string;
  nombrePersonnes: number;
  heuresPresence: number;
  taches: string;
}

interface ActiviteEntry {
  id: string;
  lot: string;
  description: string;
  avancement: number;
  zone: string;
  statut: 'en_cours' | 'termine' | 'bloque';
}

interface LivraisonEntry {
  id: string;
  fournisseur: string;
  materiaux: string;
  quantite: string;
  conforme: boolean;
  observations?: string;
}

interface IncidentEntry {
  id: string;
  type: 'technique' | 'securite' | 'qualite' | 'retard' | 'autre';
  gravite: 'mineur' | 'moyen' | 'majeur';
  description: string;
  actionsCorrectives?: string;
  resolu: boolean;
}

interface PhotoEntry {
  id: string;
  url: string;
  description: string;
  zone: string;
  timestamp: string;
}

interface SecuriteEntry {
  portEPI: boolean;
  balisageOK: boolean;
  stockageMateriauxOK: boolean;
  propreteSite: boolean;
  observations?: string;
}

// NOTE: Les données mockées ont été supprimées.
// Le composant utilise maintenant le hook useJournalEntries pour les données réelles.

const MeteoIcon = ({ condition }: { condition: string }) => {
  switch (condition) {
    case 'ensoleille': return <Sun className="h-5 w-5 text-yellow-500" />;
    case 'nuageux': return <Cloud className="h-5 w-5 text-gray-500" />;
    case 'pluie': return <CloudRain className="h-5 w-5 text-blue-500" />;
    case 'neige': return <CloudSnow className="h-5 w-5 text-blue-300" />;
    case 'vent': return <Wind className="h-5 w-5 text-gray-600" />;
    default: return <Cloud className="h-5 w-5" />;
  }
};

const getMeteoLabel = (condition: string) => {
  const labels: Record<string, string> = {
    'ensoleille': 'Ensoleillé',
    'nuageux': 'Nuageux',
    'pluie': 'Pluie',
    'neige': 'Neige',
    'vent': 'Vent fort'
  };
  return labels[condition] || condition;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'brouillon':
      return <Badge variant="outline" className="bg-gray-50">Brouillon</Badge>;
    case 'valide':
      return <Badge className="bg-green-100 text-green-800">Validé</Badge>;
    case 'cloture':
      return <Badge className="bg-blue-100 text-blue-800">Clôturé</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getIncidentBadge = (gravite: string) => {
  switch (gravite) {
    case 'mineur':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Mineur</Badge>;
    case 'moyen':
      return <Badge className="bg-orange-100 text-orange-800">Moyen</Badge>;
    case 'majeur':
      return <Badge className="bg-red-100 text-red-800">Majeur</Badge>;
    default:
      return <Badge variant="outline">{gravite}</Badge>;
  }
};

export default function JournalPage() {
  const { projectId, chantierId } = useParams();

  // Hook pour les données réelles depuis Supabase
  const {
    entries: dbEntries,
    isLoading,
    createEntry,
    validateEntry,
    isCreating,
  } = useJournalEntries({
    projectId: projectId,
    chantierId: chantierId,
  });

  // Mapper les données DB vers le format UI local
  const entries = useMemo<JournalEntry[]>(() => {
    if (!dbEntries || dbEntries.length === 0) return [];

    return dbEntries.map(e => ({
      id: e.id,
      date: e.date,
      meteo: {
        condition: (e.meteo?.condition as any) || 'nuageux',
        temperature: e.meteo?.temperature || e.meteo?.temperature_max || 15,
        intemperies: e.meteo?.intemperies || false,
        arretChantier: e.meteo?.arret_chantier || false
      },
      effectifs: (e.effectifs || []).map((ef: any) => ({
        id: ef.id || crypto.randomUUID(),
        entreprise: ef.entreprise || '',
        lot: ef.lot || '',
        nombrePersonnes: ef.nombre_personnes || ef.nombrePersonnes || 0,
        heuresPresence: ef.heures_presence || ef.heuresPresence || 0,
        taches: ef.taches || ''
      })),
      activites: (e.activites || []).map((a: any) => ({
        id: a.id || crypto.randomUUID(),
        lot: a.lot || '',
        description: a.description || '',
        avancement: a.avancement || 0,
        zone: a.zone || '',
        statut: a.statut || 'en_cours'
      })),
      livraisons: (e.livraisons || []).map((l: any) => ({
        id: l.id || crypto.randomUUID(),
        fournisseur: l.fournisseur || '',
        materiaux: l.materiaux || '',
        quantite: l.quantite || '',
        conforme: l.conforme !== false,
        observations: l.commentaire || l.observations
      })),
      incidents: (e.incidents || []).map((i: any) => ({
        id: i.id || crypto.randomUUID(),
        type: i.type || 'autre',
        gravite: i.gravite || 'mineur',
        description: i.description || '',
        actionsCorrectives: i.mesures_prises || i.actionsCorrectives,
        resolu: false
      })),
      observations: e.observations || '',
      photos: (e.photos || []).map((p: any) => typeof p === 'string' ? { id: p, url: p, description: '', zone: '', timestamp: '' } : p),
      securite: {
        portEPI: e.securite?.port_epi !== false,
        balisageOK: e.securite?.balisage_ok !== false,
        stockageMateriauxOK: e.securite?.stockage_materiaux_ok !== false,
        propreteSite: e.securite?.proprete_site !== false,
        observations: e.securite?.incidents_securite
      },
      validePar: e.valide_par,
      valideDate: e.valide_date,
      status: e.status as any || 'brouillon'
    }));
  }, [dbEntries]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showNewEntryDialog, setShowNewEntryDialog] = useState(false);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filterLot, setFilterLot] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // New entry form state
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry>>({
    meteo: {
      condition: 'ensoleille',
      temperature: 15,
      intemperies: false,
      arretChantier: false
    },
    effectifs: [],
    activites: [],
    livraisons: [],
    incidents: [],
    observations: '',
    photos: [],
    securite: {
      portEPI: true,
      balisageOK: true,
      stockageMateriauxOK: true,
      propreteSite: true
    },
    status: 'brouillon'
  });

  // Get week days
  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  });

  // Get entry for selected date
  const getEntryForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return entries.find(e => e.date === dateStr);
  };

  // Calculate stats
  const stats = {
    totalJours: entries.length,
    joursValides: entries.filter(e => e.status === 'valide' || e.status === 'cloture').length,
    incidents: entries.reduce((sum, e) => sum + e.incidents.length, 0),
    arretsMétéo: entries.filter(e => e.meteo.arretChantier).length,
    effectifMoyen: entries.length > 0
      ? Math.round(entries.reduce((sum, e) => sum + e.effectifs.reduce((s, ef) => s + ef.nombrePersonnes, 0), 0) / entries.length)
      : 0
  };

  const handleCreateEntry = () => {
    // Utiliser le hook pour créer l'entrée dans la DB
    createEntry({
      date: selectedDate.toISOString().split('T')[0],
      meteo: {
        condition: newEntry.meteo?.condition as any,
        temperature_min: newEntry.meteo?.temperature,
        temperature_max: newEntry.meteo?.temperature,
        intemperies: newEntry.meteo?.intemperies,
        arret_chantier: newEntry.meteo?.arretChantier,
      },
      effectifs: newEntry.effectifs?.map(ef => ({
        ...ef,
        nombre_personnes: ef.nombrePersonnes,
        heures_presence: ef.heuresPresence,
      })),
      activites: newEntry.activites,
      livraisons: newEntry.livraisons,
      incidents: newEntry.incidents,
      observations: newEntry.observations,
      securite: {
        port_epi: newEntry.securite?.portEPI,
        balisage_ok: newEntry.securite?.balisageOK,
        stockage_materiaux_ok: newEntry.securite?.stockageMateriauxOK,
        proprete_site: newEntry.securite?.propreteSite,
      },
      status: 'brouillon',
    });

    setShowNewEntryDialog(false);
    // Reset form
    setNewEntry({
      meteo: { condition: 'ensoleille', temperature: 15, intemperies: false, arretChantier: false },
      effectifs: [],
      activites: [],
      livraisons: [],
      incidents: [],
      observations: '',
      photos: [],
      securite: { portEPI: true, balisageOK: true, stockageMateriauxOK: true, propreteSite: true },
      status: 'brouillon'
    });
  };

  const handleValidateEntry = (entry: JournalEntry) => {
    // Utiliser le hook pour valider l'entrée
    validateEntry({ id: entry.id, validateur: 'Utilisateur' });
  };

  // État de chargement
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-8 w-40" />
            </div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Journal de Chantier</h1>
          <p className="text-muted-foreground mt-1">
            Suivi quotidien des activités, effectifs et événements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter PDF
          </Button>
          <Dialog open={showNewEntryDialog} onOpenChange={setShowNewEntryDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle entrée
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouvelle entrée - {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}</DialogTitle>
                <DialogDescription>
                  Créez une nouvelle entrée pour ce jour
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Météo */}
                <div className="space-y-2">
                  <Label className="font-medium">Conditions météo</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Condition</Label>
                      <Select
                        value={newEntry.meteo?.condition}
                        onValueChange={(v) => setNewEntry({
                          ...newEntry,
                          meteo: { ...newEntry.meteo!, condition: v as any }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ensoleille">☀️ Ensoleillé</SelectItem>
                          <SelectItem value="nuageux">☁️ Nuageux</SelectItem>
                          <SelectItem value="pluie">🌧️ Pluie</SelectItem>
                          <SelectItem value="neige">❄️ Neige</SelectItem>
                          <SelectItem value="vent">💨 Vent fort</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Température (°C)</Label>
                      <Input
                        type="number"
                        value={newEntry.meteo?.temperature}
                        onChange={(e) => setNewEntry({
                          ...newEntry,
                          meteo: { ...newEntry.meteo!, temperature: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="intemperies"
                        checked={newEntry.meteo?.intemperies}
                        onCheckedChange={(checked) => setNewEntry({
                          ...newEntry,
                          meteo: { ...newEntry.meteo!, intemperies: checked as boolean }
                        })}
                      />
                      <Label htmlFor="intemperies" className="text-sm">Intempéries</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="arret"
                        checked={newEntry.meteo?.arretChantier}
                        onCheckedChange={(checked) => setNewEntry({
                          ...newEntry,
                          meteo: { ...newEntry.meteo!, arretChantier: checked as boolean }
                        })}
                      />
                      <Label htmlFor="arret" className="text-sm">Arrêt chantier</Label>
                    </div>
                  </div>
                </div>

                {/* Sécurité */}
                <div className="space-y-2">
                  <Label className="font-medium">Contrôle sécurité</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="epi"
                        checked={newEntry.securite?.portEPI}
                        onCheckedChange={(checked) => setNewEntry({
                          ...newEntry,
                          securite: { ...newEntry.securite!, portEPI: checked as boolean }
                        })}
                      />
                      <Label htmlFor="epi" className="text-sm">Port des EPI</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="balisage"
                        checked={newEntry.securite?.balisageOK}
                        onCheckedChange={(checked) => setNewEntry({
                          ...newEntry,
                          securite: { ...newEntry.securite!, balisageOK: checked as boolean }
                        })}
                      />
                      <Label htmlFor="balisage" className="text-sm">Balisage OK</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="stockage"
                        checked={newEntry.securite?.stockageMateriauxOK}
                        onCheckedChange={(checked) => setNewEntry({
                          ...newEntry,
                          securite: { ...newEntry.securite!, stockageMateriauxOK: checked as boolean }
                        })}
                      />
                      <Label htmlFor="stockage" className="text-sm">Stockage OK</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="proprete"
                        checked={newEntry.securite?.propreteSite}
                        onCheckedChange={(checked) => setNewEntry({
                          ...newEntry,
                          securite: { ...newEntry.securite!, propreteSite: checked as boolean }
                        })}
                      />
                      <Label htmlFor="proprete" className="text-sm">Propreté site</Label>
                    </div>
                  </div>
                </div>

                {/* Observations */}
                <div className="space-y-2">
                  <Label className="font-medium">Observations générales</Label>
                  <Textarea
                    placeholder="Notes et observations du jour..."
                    value={newEntry.observations}
                    onChange={(e) => setNewEntry({ ...newEntry, observations: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewEntryDialog(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateEntry}>
                  Créer l'entrée
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jours enregistrés</p>
                <p className="text-2xl font-bold">{stats.totalJours}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jours validés</p>
                <p className="text-2xl font-bold">{stats.joursValides}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incidents</p>
                <p className="text-2xl font-bold">{stats.incidents}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Arrêts météo</p>
                <p className="text-2xl font-bold">{stats.arretsMétéo}</p>
              </div>
              <CloudRain className="h-8 w-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Effectif moyen</p>
                <p className="text-2xl font-bold">{stats.effectifMoyen}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekStart(subDays(currentWeekStart, 7))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Semaine précédente
            </Button>
            <h3 className="font-medium">
              Semaine du {format(currentWeekStart, 'd MMMM', { locale: fr })} au {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'd MMMM yyyy', { locale: fr })}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
            >
              Semaine suivante
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Week Calendar */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const entry = getEntryForDate(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDate(day);
                    if (entry) {
                      setSelectedEntry(entry);
                      setShowEntryDetail(true);
                    }
                  }}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
                    ${isCurrentDay ? 'bg-blue-50' : 'bg-background'}
                    ${entry ? 'hover:shadow-md' : 'hover:bg-muted/50'}
                  `}
                >
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">
                      {format(day, 'EEE', { locale: fr })}
                    </p>
                    <p className={`text-lg font-semibold ${isCurrentDay ? 'text-blue-600' : ''}`}>
                      {format(day, 'd')}
                    </p>
                  </div>

                  {entry ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-center gap-1">
                        <MeteoIcon condition={entry.meteo.condition} />
                        <span className="text-xs">{entry.meteo.temperature}°</span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {entry.effectifs.reduce((s, e) => s + e.nombrePersonnes, 0)}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        {getStatusBadge(entry.status)}
                      </div>
                      {entry.incidents.length > 0 && (
                        <div className="flex justify-center">
                          <Badge variant="destructive" className="text-xs">
                            {entry.incidents.length} incident(s)
                          </Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-center">
                      <p className="text-xs text-muted-foreground">Pas d'entrée</p>
                      {isSameDay(day, selectedDate) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-6 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNewEntryDialog(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Créer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={showEntryDetail} onOpenChange={setShowEntryDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedEntry && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">
                      Journal du {format(parseISO(selectedEntry.date), 'EEEE d MMMM yyyy', { locale: fr })}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedEntry.status)}
                      {selectedEntry.validePar && (
                        <span className="text-sm">
                          Validé par {selectedEntry.validePar}
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="resume" className="mt-4">
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="resume">Résumé</TabsTrigger>
                  <TabsTrigger value="effectifs">Effectifs</TabsTrigger>
                  <TabsTrigger value="activites">Activités</TabsTrigger>
                  <TabsTrigger value="livraisons">Livraisons</TabsTrigger>
                  <TabsTrigger value="incidents">Incidents</TabsTrigger>
                  <TabsTrigger value="securite">Sécurité</TabsTrigger>
                </TabsList>

                {/* Résumé */}
                <TabsContent value="resume" className="space-y-4">
                  {/* Météo */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Cloud className="h-4 w-4" />
                        Conditions météorologiques
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <MeteoIcon condition={selectedEntry.meteo.condition} />
                          <span>{getMeteoLabel(selectedEntry.meteo.condition)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Thermometer className="h-4 w-4 text-red-500" />
                          <span>{selectedEntry.meteo.temperature}°C</span>
                        </div>
                        {selectedEntry.meteo.intemperies && (
                          <Badge variant="outline" className="bg-blue-50">Intempéries</Badge>
                        )}
                        {selectedEntry.meteo.arretChantier && (
                          <Badge variant="destructive">Arrêt chantier</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Résumé effectifs */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Effectifs du jour
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-2xl font-bold">
                            {selectedEntry.effectifs.reduce((s, e) => s + e.nombrePersonnes, 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">personnes</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {selectedEntry.effectifs.length}
                          </p>
                          <p className="text-sm text-muted-foreground">entreprises</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {selectedEntry.effectifs.reduce((s, e) => s + (e.nombrePersonnes * e.heuresPresence), 0)}h
                          </p>
                          <p className="text-sm text-muted-foreground">heures totales</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Observations */}
                  {selectedEntry.observations && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Observations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{selectedEntry.observations}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Effectifs */}
                <TabsContent value="effectifs">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">Présences par entreprise</CardTitle>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedEntry.effectifs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucun effectif enregistré
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedEntry.effectifs.map((effectif) => (
                            <div
                              key={effectif.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <HardHat className="h-5 w-5 text-orange-500" />
                                <div>
                                  <p className="font-medium">{effectif.entreprise}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {effectif.lot} - {effectif.taches}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{effectif.nombrePersonnes} pers.</p>
                                <p className="text-sm text-muted-foreground">{effectif.heuresPresence}h</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Activités */}
                <TabsContent value="activites">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">Activités réalisées</CardTitle>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedEntry.activites.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucune activité enregistrée
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedEntry.activites.map((activite) => (
                            <div
                              key={activite.id}
                              className="p-3 border rounded-lg"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Wrench className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium">{activite.lot}</span>
                                  <Badge variant="outline">{activite.zone}</Badge>
                                </div>
                                <Badge className={
                                  activite.statut === 'termine' ? 'bg-green-100 text-green-800' :
                                  activite.statut === 'bloque' ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                                }>
                                  {activite.statut === 'termine' ? 'Terminé' :
                                   activite.statut === 'bloque' ? 'Bloqué' : 'En cours'}
                                </Badge>
                              </div>
                              <p className="text-sm mb-2">{activite.description}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                  <div
                                    className="h-2 bg-blue-500 rounded-full"
                                    style={{ width: `${activite.avancement}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{activite.avancement}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Livraisons */}
                <TabsContent value="livraisons">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">Livraisons du jour</CardTitle>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedEntry.livraisons.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucune livraison enregistrée
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedEntry.livraisons.map((livraison) => (
                            <div
                              key={livraison.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Truck className="h-5 w-5 text-gray-500" />
                                <div>
                                  <p className="font-medium">{livraison.fournisseur}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {livraison.materiaux} - {livraison.quantite}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {livraison.conforme ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Conforme
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Non conforme
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Incidents */}
                <TabsContent value="incidents">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">Incidents signalés</CardTitle>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Signaler
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedEntry.incidents.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Aucun incident signalé ce jour
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedEntry.incidents.map((incident) => (
                            <div
                              key={incident.id}
                              className="p-3 border rounded-lg"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  <Badge variant="outline">{incident.type}</Badge>
                                  {getIncidentBadge(incident.gravite)}
                                </div>
                                {incident.resolu && (
                                  <Badge className="bg-green-100 text-green-800">Résolu</Badge>
                                )}
                              </div>
                              <p className="text-sm">{incident.description}</p>
                              {incident.actionsCorrectives && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  <strong>Actions:</strong> {incident.actionsCorrectives}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Sécurité */}
                <TabsContent value="securite">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Contrôle sécurité du jour
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          {selectedEntry.securite.portEPI ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span>Port des EPI</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          {selectedEntry.securite.balisageOK ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span>Balisage zone</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          {selectedEntry.securite.stockageMateriauxOK ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span>Stockage matériaux</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          {selectedEntry.securite.propreteSite ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span>Propreté du site</span>
                        </div>
                      </div>
                      {selectedEntry.securite.observations && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm">{selectedEntry.securite.observations}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                {selectedEntry.status === 'brouillon' && (
                  <>
                    <Button variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                    <Button onClick={() => handleValidateEntry(selectedEntry)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Valider l'entrée
                    </Button>
                  </>
                )}
                {selectedEntry.status === 'valide' && (
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent Entries List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historique des entrées</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-8 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterLot} onValueChange={setFilterLot}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tous les lots" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les lots</SelectItem>
                  <SelectItem value="gros-oeuvre">Gros œuvre</SelectItem>
                  <SelectItem value="electricite">Électricité</SelectItem>
                  <SelectItem value="plomberie">Plomberie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => {
                  setSelectedEntry(entry);
                  setShowEntryDetail(true);
                }}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold">
                      {format(parseISO(entry.date), 'd')}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {format(parseISO(entry.date), 'MMM', { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MeteoIcon condition={entry.meteo.condition} />
                    <span className="text-sm">{entry.meteo.temperature}°C</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {entry.effectifs.reduce((s, e) => s + e.nombrePersonnes, 0)} pers.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {entry.activites.length} activité(s)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {entry.incidents.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {entry.incidents.length} incident(s)
                    </Badge>
                  )}
                  {getStatusBadge(entry.status)}
                  <Button variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
