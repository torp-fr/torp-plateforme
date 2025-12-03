/**
 * ProTickets Page
 * Gestion des tickets TORP générés pour les professionnels B2B
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  Ticket,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  QrCode,
  Calendar,
  Building2,
} from 'lucide-react';

interface TorpTicket {
  id: string;
  reference: string;
  analyse_id: string;
  nom_projet: string | null;
  client_nom: string | null;
  score_torp: number;
  grade: string;
  status: 'draft' | 'active' | 'expired' | 'revoked';
  date_generation: string;
  date_expiration: string | null;
  qr_code_url: string | null;
  pdf_url: string | null;
}

export default function ProTickets() {
  const { user } = useApp();
  const [tickets, setTickets] = useState<TorpTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (user?.id) {
      loadTickets();
    }
  }, [user?.id]);

  async function loadTickets() {
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
        .from('torp_tickets')
        .select('*')
        .eq('company_id', company.id)
        .order('date_generation', { ascending: false });

      setTickets(data || []);
    } catch (error) {
      console.error('[ProTickets] Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nom_projet?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.client_nom?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
      case 'active':
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Actif
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Brouillon
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="text-orange-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expiré
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="destructive">
            Révoqué
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function isExpiringSoon(date: string | null) {
    if (!date) return false;
    const expDate = new Date(date);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    return expDate <= sevenDaysFromNow && expDate > new Date();
  }

  return (
    <ProLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mes tickets TORP</h1>
            <p className="text-muted-foreground">
              Gérez vos certificats de conformité TORP
            </p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence, projet ou client..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="expired">Expirés</SelectItem>
              <SelectItem value="revoked">Révoqués</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'Aucun ticket correspondant'
                  : 'Aucun ticket TORP pour le moment'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <p className="text-sm text-muted-foreground">
                  Les tickets sont générés automatiquement après l'analyse d'un devis
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className={`hover:shadow-md transition-shadow ${
                  isExpiringSoon(ticket.date_expiration) ? 'border-orange-300' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Grade */}
                      <div
                        className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white ${getGradeBg(
                          ticket.grade
                        )}`}
                      >
                        <span className="font-bold text-lg">{ticket.grade}</span>
                        <span className="text-xs opacity-80">{ticket.score_torp}</span>
                      </div>

                      {/* Infos */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium">
                            {ticket.reference}
                          </span>
                          {getStatusBadge(ticket.status)}
                          {isExpiringSoon(ticket.date_expiration) && (
                            <Badge variant="outline" className="text-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expire bientôt
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ticket.nom_projet || 'Projet sans nom'}
                        </p>
                        {ticket.client_nom && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {ticket.client_nom}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Généré le {new Date(ticket.date_generation).toLocaleDateString('fr-FR')}
                          {ticket.date_expiration && (
                            <span>
                              {' '}• Expire le {new Date(ticket.date_expiration).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/pro/tickets/${ticket.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Voir
                        </Link>
                      </Button>
                      {ticket.qr_code_url && (
                        <Button variant="outline" size="sm">
                          <QrCode className="h-4 w-4 mr-1" />
                          QR
                        </Button>
                      )}
                      {ticket.pdf_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={ticket.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Ticket className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-700">
                  Qu'est-ce qu'un ticket TORP ?
                </p>
                <ul className="text-sm text-blue-600 mt-2 space-y-1">
                  <li>• Certificat de conformité numérique pour vos devis</li>
                  <li>• QR code vérifiable par vos clients</li>
                  <li>• Score et grade TORP officiels</li>
                  <li>• Valide 6 mois après génération</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProLayout>
  );
}
