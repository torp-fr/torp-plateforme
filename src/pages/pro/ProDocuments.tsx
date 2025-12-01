/**
 * TORP B2B - Gestion des Documents Entreprise
 * @route /pro/documents
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Trash2,
  AlertCircle,
  Eye,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type DocumentType =
  | 'KBIS'
  | 'ATTESTATION_URSSAF'
  | 'ATTESTATION_VIGILANCE'
  | 'ASSURANCE_DECENNALE'
  | 'ASSURANCE_RC_PRO'
  | 'CERTIFICATION_QUALIBAT'
  | 'CERTIFICATION_RGE'
  | 'CERTIFICATION_QUALIFELEC'
  | 'CERTIFICATION_QUALIPAC'
  | 'LABEL_AUTRE'
  | 'AUTRE';

type DocumentStatus = 'PENDING' | 'VALID' | 'EXPIRING' | 'EXPIRED' | 'INVALID';

interface CompanyDocument {
  id: string;
  type: DocumentType;
  nom: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  date_emission: string | null;
  date_expiration: string | null;
  numero_document: string | null;
  emetteur: string | null;
  statut: DocumentStatus;
  uploaded_at: string;
}

const DOC_TYPES: Record<DocumentType, { label: string; icon: string }> = {
  KBIS: { label: 'KBIS', icon: '🏢' },
  ATTESTATION_URSSAF: { label: 'Attestation URSSAF', icon: '📋' },
  ATTESTATION_VIGILANCE: { label: 'Attestation Vigilance', icon: '📋' },
  ASSURANCE_DECENNALE: { label: 'Assurance Décennale', icon: '🛡️' },
  ASSURANCE_RC_PRO: { label: 'RC Professionnelle', icon: '🛡️' },
  CERTIFICATION_QUALIBAT: { label: 'Qualibat', icon: '🏆' },
  CERTIFICATION_RGE: { label: 'RGE', icon: '🏆' },
  CERTIFICATION_QUALIFELEC: { label: 'Qualifelec', icon: '🏆' },
  CERTIFICATION_QUALIPAC: { label: 'QualiPAC', icon: '🏆' },
  LABEL_AUTRE: { label: 'Autre Label', icon: '🏆' },
  AUTRE: { label: 'Autre', icon: '📄' },
};

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; color: string; icon: React.ReactNode; badge: string }
> = {
  PENDING: {
    label: 'En attente de vérification',
    color: 'text-gray-600',
    icon: <Clock className="w-5 h-5" />,
    badge: 'bg-gray-100 text-gray-800',
  },
  VALID: {
    label: 'Valide',
    color: 'text-green-600',
    icon: <CheckCircle className="w-5 h-5" />,
    badge: 'bg-green-100 text-green-800',
  },
  EXPIRING: {
    label: 'Expire bientôt',
    color: 'text-orange-600',
    icon: <AlertTriangle className="w-5 h-5" />,
    badge: 'bg-orange-100 text-orange-800',
  },
  EXPIRED: {
    label: 'Expiré',
    color: 'text-red-600',
    icon: <XCircle className="w-5 h-5" />,
    badge: 'bg-red-100 text-red-800',
  },
  INVALID: {
    label: 'Invalide',
    color: 'text-red-600',
    icon: <XCircle className="w-5 h-5" />,
    badge: 'bg-red-100 text-red-800',
  },
};

export default function ProDocuments() {
  const navigate = useNavigate();
  const { userType, user } = useApp();

  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    type: '' as DocumentType | '',
    nom: '',
    file: null as File | null,
    date_emission: '',
    date_expiration: '',
    numero_document: '',
    emetteur: '',
  });

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (userType !== 'B2B') {
      navigate('/dashboard');
      return;
    }
    loadDocuments();
  }, [userType, navigate, user]);

  useEffect(() => {
    applyFilters();
  }, [documents, typeFilter, statusFilter]);

  const loadDocuments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Récupérer le profil entreprise
      const { data: companyProfile } = await supabase
        .from('pro_company_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!companyProfile) {
        setError('Profil entreprise introuvable');
        return;
      }

      setCompanyId(companyProfile.id);

      // Récupérer tous les documents
      const { data, error: fetchError } = await supabase
        .from('company_documents')
        .select('*')
        .eq('company_id', companyProfile.id)
        .order('uploaded_at', { ascending: false });

      if (fetchError) throw fetchError;

      setDocuments(data || []);
    } catch (err) {
      console.error('Erreur chargement documents:', err);
      setError('Impossible de charger les documents');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...documents];

    if (typeFilter !== 'all') {
      filtered = filtered.filter((d) => d.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.statut === statusFilter);
    }

    setFilteredDocs(filtered);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm((prev) => ({
        ...prev,
        file,
        nom: prev.nom || file.name,
      }));
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.type || !companyId) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setUploading(true);

      // 1. Upload fichier vers Supabase Storage
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${companyId}/${Date.now()}_${uploadForm.type}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(fileName, uploadForm.file);

      if (uploadError) throw uploadError;

      // 2. Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('company-documents')
        .getPublicUrl(fileName);

      // 3. Calculer le statut initial basé sur la date d'expiration
      let statut: DocumentStatus = 'PENDING';
      if (uploadForm.date_expiration) {
        const expirationDate = new Date(uploadForm.date_expiration);
        const now = new Date();
        const daysUntilExpiration = Math.floor(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiration < 0) {
          statut = 'EXPIRED';
        } else if (daysUntilExpiration <= 30) {
          statut = 'EXPIRING';
        } else {
          statut = 'VALID';
        }
      }

      // 4. Insérer le document dans la BDD
      const { error: insertError } = await supabase.from('company_documents').insert({
        company_id: companyId,
        type: uploadForm.type,
        nom: uploadForm.nom,
        file_url: urlData.publicUrl,
        file_name: uploadForm.file.name,
        file_size: uploadForm.file.size,
        mime_type: uploadForm.file.type,
        date_emission: uploadForm.date_emission || null,
        date_expiration: uploadForm.date_expiration || null,
        numero_document: uploadForm.numero_document || null,
        emetteur: uploadForm.emetteur || null,
        statut,
      });

      if (insertError) throw insertError;

      // Recharger les documents
      await loadDocuments();

      // Réinitialiser le formulaire
      setUploadForm({
        type: '',
        nom: '',
        file: null,
        date_emission: '',
        date_expiration: '',
        numero_document: '',
        emetteur: '',
      });
      setUploadDialogOpen(false);
    } catch (err) {
      console.error('Erreur upload document:', err);
      alert('Erreur lors de l\'upload du document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, fileUrl: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      // 1. Supprimer de Supabase Storage
      const pathMatch = fileUrl.match(/company-documents\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from('company-documents').remove([pathMatch[1]]);
      }

      // 2. Supprimer de la BDD
      const { error } = await supabase.from('company_documents').delete().eq('id', docId);

      if (error) throw error;

      // Recharger
      await loadDocuments();
    } catch (err) {
      console.error('Erreur suppression document:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const downloadDocument = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    link.click();
  };

  const alertsCount = documents.filter(
    (d) => d.statut === 'EXPIRING' || d.statut === 'EXPIRED'
  ).length;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des documents...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pro/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au dashboard
        </Button>

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Mes documents</h1>
            <p className="text-muted-foreground">
              Gérez vos documents administratifs et certifications
            </p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Ajouter un document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Ajouter un document</DialogTitle>
                <DialogDescription>
                  Importez un nouveau document et renseignez ses informations
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="doc-type">Type de document *</Label>
                  <Select
                    value={uploadForm.type}
                    onValueChange={(value) =>
                      setUploadForm((prev) => ({ ...prev, type: value as DocumentType }))
                    }
                  >
                    <SelectTrigger id="doc-type">
                      <SelectValue placeholder="Sélectionnez un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOC_TYPES).map(([key, { label, icon }]) => (
                        <SelectItem key={key} value={key}>
                          {icon} {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="doc-nom">Nom du document *</Label>
                  <Input
                    id="doc-nom"
                    value={uploadForm.nom}
                    onChange={(e) =>
                      setUploadForm((prev) => ({ ...prev, nom: e.target.value }))
                    }
                    placeholder="Ex: Assurance décennale 2024"
                  />
                </div>

                <div>
                  <Label htmlFor="doc-file">Fichier *</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {uploadForm.file && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {uploadForm.file.name} ({(uploadForm.file.size / 1024 / 1024).toFixed(2)} Mo)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="doc-emission">Date d'émission</Label>
                    <Input
                      id="doc-emission"
                      type="date"
                      value={uploadForm.date_emission}
                      onChange={(e) =>
                        setUploadForm((prev) => ({ ...prev, date_emission: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="doc-expiration">Date d'expiration</Label>
                    <Input
                      id="doc-expiration"
                      type="date"
                      value={uploadForm.date_expiration}
                      onChange={(e) =>
                        setUploadForm((prev) => ({ ...prev, date_expiration: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="doc-numero">Numéro de document</Label>
                    <Input
                      id="doc-numero"
                      value={uploadForm.numero_document}
                      onChange={(e) =>
                        setUploadForm((prev) => ({ ...prev, numero_document: e.target.value }))
                      }
                      placeholder="Ex: 123456789"
                    />
                  </div>
                  <div>
                    <Label htmlFor="doc-emetteur">Émetteur</Label>
                    <Input
                      id="doc-emetteur"
                      value={uploadForm.emetteur}
                      onChange={(e) =>
                        setUploadForm((prev) => ({ ...prev, emetteur: e.target.value }))
                      }
                      placeholder="Ex: AXA, Qualibat"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setUploadDialogOpen(false)}
                    disabled={uploading}
                  >
                    Annuler
                  </Button>
                  <Button onClick={handleUpload} disabled={uploading}>
                    {uploading ? 'Upload en cours...' : 'Ajouter'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Alertes */}
        {alertsCount > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-semibold text-orange-900">
                    {alertsCount} document{alertsCount > 1 ? 's' : ''} nécessite
                    {alertsCount > 1 ? 'nt' : ''} votre attention
                  </p>
                  <p className="text-sm text-orange-700">
                    Des documents expirent bientôt ou sont déjà expirés
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtres */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Type de document</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {Object.entries(DOC_TYPES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des documents */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {filteredDocs.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun document</h3>
                <p className="text-muted-foreground mb-4">
                  {typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'Aucun document ne correspond à vos critères'
                    : "Vous n'avez pas encore ajouté de document"}
                </p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  Ajouter mon premier document
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{DOC_TYPES[doc.type].icon}</div>
                      <div>
                        <CardTitle className="text-lg">{doc.nom}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {DOC_TYPES[doc.type].label}
                        </p>
                      </div>
                    </div>
                    <Badge className={STATUS_CONFIG[doc.statut].badge}>
                      {STATUS_CONFIG[doc.statut].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {doc.numero_document && (
                      <div>
                        <span className="text-muted-foreground">Numéro : </span>
                        <span className="font-medium">{doc.numero_document}</span>
                      </div>
                    )}
                    {doc.emetteur && (
                      <div>
                        <span className="text-muted-foreground">Émetteur : </span>
                        <span className="font-medium">{doc.emetteur}</span>
                      </div>
                    )}
                    {doc.date_emission && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Émis le : </span>
                        <span className="font-medium">
                          {new Date(doc.date_emission).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    )}
                    {doc.date_expiration && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Expire le : </span>
                        <span className="font-medium">
                          {new Date(doc.date_expiration).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 text-xs text-muted-foreground">
                      Ajouté{' '}
                      {formatDistanceToNow(new Date(doc.uploaded_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(doc.file_url, '_blank')}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Voir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadDocument(doc.file_url, doc.file_name)}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(doc.id, doc.file_url)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredDocs.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {filteredDocs.length} document{filteredDocs.length > 1 ? 's' : ''} affiché
            {filteredDocs.length > 1 ? 's' : ''}
            {(typeFilter !== 'all' || statusFilter !== 'all') && (
              <span> sur {documents.length} au total</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
