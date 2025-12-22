/**
 * ProDocuments Page
 * Gestion des documents entreprise B2B
 */

import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  Upload,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Shield,
  Award,
} from 'lucide-react';

interface Document {
  id: string;
  type: string;
  nom: string;
  file_url: string;
  date_expiration: string | null;
  statut: string;
  uploaded_at: string;
}

const DOCUMENT_TYPES = [
  { type: 'kbis', label: 'Extrait Kbis', icon: FileText, required: true },
  { type: 'assurance_decennale', label: 'Assurance décennale', icon: Shield, required: true },
  { type: 'assurance_rc', label: 'Assurance RC Pro', icon: Shield, required: true },
  { type: 'rge', label: 'Certification RGE', icon: Award, required: false },
  { type: 'qualibat', label: 'Qualibat', icon: Award, required: false },
];

export default function ProDocuments() {
  const { user } = useApp();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadDocuments();
    }
  }, [user?.id]);

  async function loadDocuments() {
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

      setCompanyId(company.id);

      const { data } = await supabase
        .from('company_documents')
        .select('*')
        .eq('company_id', company.id)
        .order('uploaded_at', { ascending: false });

      setDocuments(data || []);
    } catch (error) {
      console.error('[ProDocuments] Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  function getDocumentByType(type: string) {
    return documents.find((d) => d.type === type);
  }

  function isExpiringSoon(date: string | null) {
    if (!date) return false;
    const expDate = new Date(date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expDate <= thirtyDaysFromNow;
  }

  function isExpired(date: string | null) {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  function getStatusBadge(doc: Document | undefined, required: boolean) {
    if (!doc) {
      return required ? (
        <Badge variant="destructive">Manquant</Badge>
      ) : (
        <Badge variant="outline">Non fourni</Badge>
      );
    }

    if (doc.date_expiration && isExpired(doc.date_expiration)) {
      return <Badge variant="destructive">Expiré</Badge>;
    }

    if (doc.date_expiration && isExpiringSoon(doc.date_expiration)) {
      return <Badge className="bg-orange-500">Expire bientôt</Badge>;
    }

    if (doc.statut === 'verified') {
      return <Badge className="bg-green-500">Vérifié</Badge>;
    }

    return <Badge variant="secondary">En attente</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mes documents</h1>
            <p className="text-muted-foreground">
              Gérez les documents légaux et certifications de votre entreprise
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Documents requis */}
            <Card>
              <CardHeader>
                <CardTitle>Documents obligatoires</CardTitle>
                <CardDescription>
                  Ces documents sont nécessaires pour générer des tickets TORP
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {DOCUMENT_TYPES.filter((t) => t.required).map((docType) => {
                  const doc = getDocumentByType(docType.type);
                  const Icon = docType.icon;

                  return (
                    <div
                      key={docType.type}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{docType.label}</p>
                          {doc?.date_expiration && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expire le {new Date(doc.date_expiration).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(doc, true)}
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          {doc ? 'Remplacer' : 'Ajouter'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Certifications optionnelles */}
            <Card>
              <CardHeader>
                <CardTitle>Certifications et labels</CardTitle>
                <CardDescription>
                  Ajoutez vos certifications pour améliorer votre score TORP
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {DOCUMENT_TYPES.filter((t) => !t.required).map((docType) => {
                  const doc = getDocumentByType(docType.type);
                  const Icon = docType.icon;

                  return (
                    <div
                      key={docType.type}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{docType.label}</p>
                          {doc?.date_expiration && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expire le {new Date(doc.date_expiration).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(doc, false)}
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          {doc ? 'Remplacer' : 'Ajouter'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-700">
                      Comment ça fonctionne ?
                    </p>
                    <ul className="text-sm text-blue-600 mt-2 space-y-1">
                      <li>• Uploadez vos documents (PDF, JPG, PNG)</li>
                      <li>• Nous vérifions automatiquement leur validité</li>
                      <li>• Les documents valides améliorent votre score TORP</li>
                      <li>• Vous serez alerté avant expiration</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
