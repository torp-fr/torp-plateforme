/**
 * ProAnalyses Page
 * Liste des analyses pour les professionnels B2B
 * Utilise la table devis existante (même que B2C)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  PlusCircle,
  Search,
  FileSearch,
  Clock,
  Loader2,
  Filter,
  Eye,
} from 'lucide-react';

interface Analysis {
  id: string;
  nom_projet: string | null;
  type_travaux: string | null;
  status: string;
  score_total: number | null;
  grade: string | null;
  montant_total: number | null;
  created_at: string;
  analyzed_at: string | null;
  file_name: string | null;
}

export default function ProAnalyses() {
  const { user } = useApp();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadAnalyses();
    }
  }, [user?.id]);

  async function loadAnalyses() {
    try {
      // Récupérer tous les devis de l'utilisateur (même table que B2C)
      const { data, error } = await supabase
        .from('devis')
        .select('id, nom_projet, type_travaux, status, score_total, grade, montant_total, created_at, analyzed_at, file_name')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ProAnalyses] Erreur:', error);
      }

      setAnalyses(data || []);
    } catch (error) {
      console.error('[ProAnalyses] Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAnalyses = analyses.filter(
    (a) =>
      a.nom_projet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.type_travaux?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function getGradeBg(grade: string) {
    switch (grade) {
      case 'A':
      case 'A+':
        return 'bg-emerald-500';
      case 'B':
        return 'bg-green-500';
      case 'C':
        return 'bg-yellow-500';
      case 'D':
        return 'bg-orange-500';
      default:
        return 'bg-red-500';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'analyzed':
        return <Badge className="bg-green-500">Terminé</Badge>;
      case 'analyzing':
        return <Badge variant="secondary">En cours</Badge>;
      case 'uploaded':
        return <Badge variant="outline">En attente</Badge>;
      default:
        return <Badge variant="destructive">Échec</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Mes analyses</h1>
          <Button asChild>
            <Link to="/pro/analyses/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nouvelle analyse
            </Link>
          </Button>
        </div>

        {/* Recherche */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par projet ou type..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileSearch className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'Aucun résultat' : 'Aucune analyse pour le moment'}
              </p>
              {!searchTerm && (
                <Button asChild>
                  <Link to="/pro/analyses/new">Analyser mon premier devis</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredAnalyses.map((analysis) => (
              <Card key={analysis.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {analysis.grade ? (
                        <span
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${getGradeBg(
                            analysis.grade
                          )}`}
                        >
                          {analysis.grade}
                        </span>
                      ) : (
                        <span className="w-12 h-12 rounded-full flex items-center justify-center bg-muted">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                      <div>
                        <p className="font-medium">
                          {analysis.nom_projet || analysis.file_name || 'Projet sans nom'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {analysis.type_travaux || 'Type non spécifié'}
                        </p>
                        {analysis.score_total && (
                          <p className="text-sm font-medium mt-1">
                            Score : {analysis.score_total}/1000
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(analysis.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {analysis.montant_total && analysis.montant_total > 0 && (
                        <span className="text-sm font-medium hidden sm:inline">
                          {analysis.montant_total.toLocaleString('fr-FR')} €
                        </span>
                      )}
                      {getStatusBadge(analysis.status)}
                      {analysis.status === 'analyzed' && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/results?devisId=${analysis.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Voir
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
