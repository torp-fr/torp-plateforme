/**
 * ReserveControleList - Liste des réserves de contrôle avec gestion
 * Permet de suivre et lever les réserves des organismes de contrôle
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Upload,
  Eye,
  Calendar,
  Building2,
  FileText,
} from 'lucide-react';

export type GraviteReserve = 'mineure' | 'majeure' | 'bloquante';
export type StatutReserveControle = 'emise' | 'en_cours_traitement' | 'levee' | 'contestee';

export interface ReserveControle {
  id: string;
  organismeId: string;
  organismeNom: string;
  missionCode?: string;
  visiteId?: string;

  // Identification
  numero: string;
  dateEmission: string;

  // Description
  localisation: string;
  description: string;
  references?: string; // Références normes/DTU

  // Classification
  gravite: GraviteReserve;
  lot?: string;
  entreprise?: string;

  // Traitement
  statut: StatutReserveControle;
  actionsCorrectives?: string;
  dateButoir?: string;
  dateLevee?: string;

  // Documents
  photosUrls?: string[];
  documentUrl?: string;

  // Levée
  leveeParQui?: string;
  leveeCommentaire?: string;
  leveePieceUrl?: string;
}

interface ReserveControleListProps {
  reserves: ReserveControle[];
  onLeverReserve?: (reserveId: string, data: { commentaire: string; pieceUrl?: string }) => Promise<void>;
  onViewDetails?: (reserve: ReserveControle) => void;
}

const GRAVITE_CONFIG: Record<GraviteReserve, { label: string; color: string; icon: React.ElementType }> = {
  mineure: { label: 'Mineure', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: AlertTriangle },
  majeure: { label: 'Majeure', color: 'bg-orange-100 text-orange-700 border-orange-300', icon: AlertTriangle },
  bloquante: { label: 'Bloquante', color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle },
};

const STATUT_CONFIG: Record<StatutReserveControle, { label: string; color: string }> = {
  emise: { label: 'Émise', color: 'bg-red-500' },
  en_cours_traitement: { label: 'En traitement', color: 'bg-yellow-500' },
  levee: { label: 'Levée', color: 'bg-green-500' },
  contestee: { label: 'Contestée', color: 'bg-purple-500' },
};

export function ReserveControleList({ reserves, onLeverReserve, onViewDetails }: ReserveControleListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGravite, setFilterGravite] = useState<GraviteReserve | 'all'>('all');
  const [filterStatut, setFilterStatut] = useState<StatutReserveControle | 'all'>('all');
  const [selectedReserve, setSelectedReserve] = useState<ReserveControle | null>(null);
  const [leveeComment, setLeveeComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrage
  const filteredReserves = reserves.filter((reserve) => {
    const matchesSearch =
      reserve.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reserve.localisation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reserve.numero.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGravite = filterGravite === 'all' || reserve.gravite === filterGravite;
    const matchesStatut = filterStatut === 'all' || reserve.statut === filterStatut;

    return matchesSearch && matchesGravite && matchesStatut;
  });

  // Stats
  const stats = {
    total: reserves.length,
    emises: reserves.filter(r => r.statut === 'emise').length,
    enCours: reserves.filter(r => r.statut === 'en_cours_traitement').length,
    levees: reserves.filter(r => r.statut === 'levee').length,
    bloquantes: reserves.filter(r => r.gravite === 'bloquante' && r.statut !== 'levee').length,
  };

  const handleLevee = async () => {
    if (!selectedReserve || !onLeverReserve) return;

    setIsSubmitting(true);
    try {
      await onLeverReserve(selectedReserve.id, { commentaire: leveeComment });
      setSelectedReserve(null);
      setLeveeComment('');
    } catch (error) {
      console.error('Erreur levée réserve:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Réserves de contrôle
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              {stats.bloquantes > 0 && (
                <Badge variant="destructive">
                  {stats.bloquantes} bloquante(s)
                </Badge>
              )}
              <Badge variant="outline">
                {stats.levees}/{stats.total} levées
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats rapides */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-red-50 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.emises}</p>
              <p className="text-xs text-red-700">À traiter</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-50 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.enCours}</p>
              <p className="text-xs text-yellow-700">En cours</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.levees}</p>
              <p className="text-xs text-green-700">Levées</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterGravite} onValueChange={(v) => setFilterGravite(v as GraviteReserve | 'all')}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Gravité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes gravités</SelectItem>
                <SelectItem value="bloquante">Bloquante</SelectItem>
                <SelectItem value="majeure">Majeure</SelectItem>
                <SelectItem value="mineure">Mineure</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={(v) => setFilterStatut(v as StatutReserveControle | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="emise">Émise</SelectItem>
                <SelectItem value="en_cours_traitement">En traitement</SelectItem>
                <SelectItem value="levee">Levée</SelectItem>
                <SelectItem value="contestee">Contestée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tableau */}
          {filteredReserves.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-muted-foreground">Aucune réserve à afficher</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Organisme</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Gravité</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReserves.map((reserve) => {
                    const graviteConfig = GRAVITE_CONFIG[reserve.gravite];
                    const statutConfig = STATUT_CONFIG[reserve.statut];
                    const isOverdue = reserve.dateButoir && new Date(reserve.dateButoir) < new Date() && reserve.statut !== 'levee';

                    return (
                      <TableRow key={reserve.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                        <TableCell className="font-mono text-sm">{reserve.numero}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{reserve.organismeNom}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm truncate">{reserve.description}</p>
                        </TableCell>
                        <TableCell className="text-sm">{reserve.localisation}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={graviteConfig.color}>
                            {graviteConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                            {formatDate(reserve.dateButoir)}
                            {isOverdue && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statutConfig.color}>{statutConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {reserve.statut !== 'levee' && onLeverReserve && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedReserve(reserve)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewDetails?.(reserve)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog levée */}
      <Dialog open={!!selectedReserve} onOpenChange={() => setSelectedReserve(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lever la réserve</DialogTitle>
            <DialogDescription>
              Réserve n°{selectedReserve?.numero} - {selectedReserve?.description.slice(0, 50)}...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Commentaire de levée</label>
              <Textarea
                value={leveeComment}
                onChange={(e) => setLeveeComment(e.target.value)}
                placeholder="Décrivez les actions correctives réalisées..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Pièce justificative (optionnel)</label>
              <Button variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Joindre un document
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReserve(null)}>
              Annuler
            </Button>
            <Button onClick={handleLevee} disabled={isSubmitting || !leveeComment}>
              {isSubmitting ? 'Enregistrement...' : 'Confirmer la levée'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReserveControleList;
