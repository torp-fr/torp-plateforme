import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  MapPin, 
  Filter, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Home,
  Construction,
  Zap,
  Droplets,
  Palette,
  Thermometer,
  Settings
} from 'lucide-react';

// Types pour les projets territoriaux
interface TerritorialProject {
  id: string;
  lat: number;
  lng: number;
  type: 'plomberie' | 'electricite' | 'peinture' | 'chauffage' | 'isolation' | 'renovation';
  score: number;
  amount: number;
  status: 'en-cours' | 'termine' | 'alerte';
  commune: string;
  date: string;
}

// Mock data pour la carte
const mockProjects: TerritorialProject[] = [
  { id: '1', lat: 47.2184, lng: -1.5536, type: 'renovation', score: 85, amount: 25000, status: 'termine', commune: 'Nantes Centre', date: '2024-03-15' },
  { id: '2', lat: 47.2220, lng: -1.5580, type: 'plomberie', score: 72, amount: 8500, status: 'en-cours', commune: 'Nantes Nord', date: '2024-03-20' },
  { id: '3', lat: 47.2100, lng: -1.5400, type: 'electricite', score: 91, amount: 12000, status: 'termine', commune: 'Nantes Sud', date: '2024-03-18' },
  { id: '4', lat: 47.2250, lng: -1.5650, type: 'chauffage', score: 45, amount: 15000, status: 'alerte', commune: 'Nantes Ouest', date: '2024-03-22' },
  { id: '5', lat: 47.2150, lng: -1.5500, type: 'isolation', score: 88, amount: 18000, status: 'termine', commune: 'Nantes Est', date: '2024-03-19' },
  { id: '6', lat: 47.2300, lng: -1.5700, type: 'peinture', score: 78, amount: 4500, status: 'en-cours', commune: 'Nantes Périphérie', date: '2024-03-21' }
];

const TerritorialMap = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>('tous');
  const [amountRange, setAmountRange] = useState([0, 50000]);
  const [selectedProject, setSelectedProject] = useState<TerritorialProject | null>(null);
  const [activeLayer, setActiveLayer] = useState('tous');

  const getProjectIcon = (type: string) => {
    const icons = {
      plomberie: Droplets,
      electricite: Zap,
      peinture: Palette,
      chauffage: Thermometer,
      isolation: Home,
      renovation: Construction
    };
    return icons[type as keyof typeof icons] || Construction;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'termine': 'default',
      'en-cours': 'secondary',
      'alerte': 'destructive'
    };
    return variants[status as keyof typeof variants] || 'outline';
  };

  const filteredProjects = mockProjects.filter(project => {
    const typeMatch = selectedFilter === 'tous' || project.type === selectedFilter;
    const amountMatch = project.amount >= amountRange[0] && project.amount <= amountRange[1];
    const layerMatch = activeLayer === 'tous' || project.type === activeLayer;
    return typeMatch && amountMatch && layerMatch;
  });

  return (
    <div className="space-y-6">
      {/* Contrôles de la carte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Cartographie Interactive Territoriale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type de projet</label>
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrer par type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les projets</SelectItem>
                  <SelectItem value="plomberie">Plomberie</SelectItem>
                  <SelectItem value="electricite">Électricité</SelectItem>
                  <SelectItem value="peinture">Peinture</SelectItem>
                  <SelectItem value="chauffage">Chauffage</SelectItem>
                  <SelectItem value="isolation">Isolation</SelectItem>
                  <SelectItem value="renovation">Rénovation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Layer actif</label>
              <Select value={activeLayer} onValueChange={setActiveLayer}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir layer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous layers</SelectItem>
                  <SelectItem value="plomberie">Layer Plomberie</SelectItem>
                  <SelectItem value="electricite">Layer Électricité</SelectItem>
                  <SelectItem value="renovation">Layer Rénovation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Montant (€)</label>
              <div className="px-2">
                <Slider
                  value={amountRange}
                  onValueChange={setAmountRange}
                  min={0}
                  max={50000}
                  step={1000}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{amountRange[0]}€</span>
                  <span>{amountRange[1]}€</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <Layers className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Simulation de carte interactive */}
          <div className="relative h-96 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            {/* Arrière-plan carte simulé */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 dark:from-blue-900 dark:to-green-900 opacity-30" />
            
            {/* Points sur la carte */}
            {filteredProjects.map((project, index) => {
              const Icon = getProjectIcon(project.type);
              const x = (project.lng + 1.5536) * 800 + 100; // Conversion simplifiée
              const y = Math.abs(project.lat - 47.2184) * 800 + 50;
              
              return (
                <div
                  key={project.id}
                  className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{ left: `${Math.min(Math.max(x % 100, 10), 90)}%`, top: `${Math.min(Math.max(y % 100, 10), 90)}%` }}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className={`w-8 h-8 rounded-full ${getScoreColor(project.score)} flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {project.status === 'alerte' && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
              );
            })}

            {/* Zones de clustering simulées */}
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-800/90 rounded-lg p-2 shadow-lg">
              <div className="text-sm font-medium">Zone Nord</div>
              <div className="text-xs text-muted-foreground">12 projets</div>
            </div>
            
            <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 rounded-lg p-2 shadow-lg">
              <div className="text-sm font-medium">Centre-Ville</div>
              <div className="text-xs text-muted-foreground">8 projets</div>
            </div>

            {/* Contrôles de zoom */}
            <div className="absolute top-4 right-4 space-y-2">
              <Button size="sm" variant="outline" className="w-8 h-8 p-0">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" className="w-8 h-8 p-0">
                <ZoomOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Légende */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full" />
              <span>Score A (80+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full" />
              <span>Score B (60-79)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full" />
              <span>Score C (&lt;60)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span>Alerte</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel de détail du projet sélectionné */}
      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Détail du Projet</span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setSelectedProject(null)}
              >
                ✕
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium mb-2">Informations Projet</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Type :</span>
                    <Badge variant="outline">{selectedProject.type}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Commune :</span>
                    <span className="font-medium">{selectedProject.commune}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date :</span>
                    <span>{selectedProject.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Statut :</span>
                    <Badge variant={getStatusBadge(selectedProject.status)}>
                      {selectedProject.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Données Financières</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Montant :</span>
                    <span className="font-bold">{selectedProject.amount.toLocaleString()}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score TORP :</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getScoreColor(selectedProject.score)}`} />
                      <span className="font-medium">{selectedProject.score}/100</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Actions</h4>
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="w-full">
                    Voir analyse complète
                  </Button>
                  <Button size="sm" variant="outline" className="w-full">
                    Exporter données
                  </Button>
                  {selectedProject.status === 'alerte' && (
                    <Button size="sm" variant="destructive" className="w-full">
                      Traiter l'alerte
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques de filtrage */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques des Filtres Actifs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {filteredProjects.length}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Projets affichés</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {filteredProjects.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}€
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Montant total</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {Math.round(filteredProjects.reduce((sum, p) => sum + p.score, 0) / filteredProjects.length) || 0}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">Score moyen</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {filteredProjects.filter(p => p.status === 'alerte').length}
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">Alertes actives</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TerritorialMap;