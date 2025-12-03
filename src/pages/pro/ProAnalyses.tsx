/**
 * ProAnalyses Page
 * Liste des analyses pour les professionnels B2B
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Ticket,
  Loader2,
  Filter,
} from 'lucide-react';

interface Analysis {
  id: string;
  reference_devis: string;
  nom_projet: string | null;
  status: string;
  score_total: number | null;
  grade: string | null;
  montant_ht: number | null;
  created_at: string;
  analyzed_at: string | null;
  ticket_genere: boolean;
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
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!company) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('pro_devis_analyses')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      setAnalyses(data || []);
    } catch (error) {
      console.error('[ProAnalyses] Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAnalyses = analyses.filter(
    (a) =>
      a.reference_devis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.nom_projet?.toLowerCase().includes(searchTerm.toLowerCase())
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
      case 'completed':
        return <Badge className="bg-green-500">Terminé</Badge>;
      case 'analyzing':
        return <Badge variant="secondary">En cours</Badge>;
      case 'pending':
        return <Badge variant="outline">En attente</Badge>;
      default:
        return <Badge variant="destructive">Échec</Badge>;
    }
  }

  return (
    <ProLayout>
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
              placeholder="Rechercher par référence ou projet..."
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
                  <Link to="/pro/analyses/new">Analyser un devis</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredAnalyses.map((analysis) => (
              <Link
                key={analysis.id}
                to={`/pro/analyses/${analysis.id}`}
                className="block"
              >
                <Card className="hover:shadow-md transition-shadow">
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
                            {analysis.reference_devis || 'Sans référence'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {analysis.nom_projet || 'Projet non nommé'}
                          </p>
                          {analysis.score_total && (
                            <p className="text-sm font-medium mt-1">
                              Score : {analysis.score_total}/1000
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {analysis.montant_ht && (
                          <span className="text-sm font-medium hidden sm:inline">
                            {analysis.montant_ht.toLocaleString('fr-FR')} € HT
                          </span>
                        )}
                        {getStatusBadge(analysis.status)}
                        {analysis.ticket_genere && (
                          <Badge variant="outline">
                            <Ticket className="h-3 w-3 mr-1" />
                            Ticket
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ProLayout>
  );
}
