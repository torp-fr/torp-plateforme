/**
 * ProCompanyProfile Page
 * Gestion complète du profil entreprise B2B
 * - Présentation entreprise (avec lookup SIRET)
 * - Moyens humains et matériels (structurés)
 * - Certifications et qualifications
 * - Références chantiers
 * - Documents administratifs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useApp,
  CompanyCertification,
  CompanyReference,
  CompanyDocument,
} from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SiretLookupService, TextOptimizerService, MaterialRecognitionService } from '@/services/company';
import type { CompanyLookupResult, OptimizationType, MaterialRecognitionResult } from '@/services/company';
import {
  EMPLOYEE_CATEGORIES,
  COMMON_EMPLOYEE_ROLES,
  MATERIAL_CATEGORIES,
  COMMON_MATERIAL_TYPES,
} from '@/types/company.types';
import type { MaterialResource, MaterialCategory } from '@/types/company.types';
import {
  Building2,
  Users,
  Wrench,
  Award,
  FileText,
  Save,
  Loader2,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Upload,
  Calendar,
  Euro,
  Building,
  Shield,
  Star,
  Phone,
  Mail,
  MapPin,
  Search,
  Sparkles,
  RefreshCw,
  Truck,
  HardHat,
  Briefcase,
  ExternalLink,
  Camera,
  ScanLine,
  ImagePlus,
  X,
} from 'lucide-react';

// Types de certifications disponibles
const CERTIFICATION_TYPES = [
  { value: 'rge', label: 'RGE (Reconnu Garant de l\'Environnement)' },
  { value: 'qualibat', label: 'Qualibat' },
  { value: 'qualifelec', label: 'Qualifelec' },
  { value: 'qualipac', label: 'Qualipac' },
  { value: 'qualisol', label: 'Qualisol' },
  { value: 'qualibois', label: 'Qualibois' },
  { value: 'qualigaz', label: 'Qualigaz' },
  { value: 'iso_9001', label: 'ISO 9001 (Qualité)' },
  { value: 'iso_14001', label: 'ISO 14001 (Environnement)' },
  { value: 'mase', label: 'MASE (Sécurité)' },
  { value: 'other', label: 'Autre certification' },
];

// Types de documents administratifs
const DOCUMENT_TYPES = [
  { value: 'kbis', label: 'Extrait Kbis' },
  { value: 'attestation_urssaf', label: 'Attestation URSSAF' },
  { value: 'attestation_fiscale', label: 'Attestation fiscale' },
  { value: 'attestation_assurance_decennale', label: 'Attestation décennale' },
  { value: 'attestation_assurance_rc', label: 'Attestation RC Pro' },
  { value: 'certificat_rge', label: 'Certificat RGE' },
  { value: 'certificat_qualibat', label: 'Certificat Qualibat' },
  { value: 'certificat_qualifelec', label: 'Certificat Qualifelec' },
  { value: 'carte_pro_btp', label: 'Carte Pro BTP' },
  { value: 'rib', label: 'RIB' },
  { value: 'other', label: 'Autre document' },
];

export default function ProCompanyProfile() {
  const { user, setUser } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('presentation');

  // État du formulaire
  const [formData, setFormData] = useState({
    // Identification
    company: '',
    company_siret: '',
    company_address: '',
    company_code_ape: '',
    company_rcs: '',
    company_capital: '',
    company_creation_date: '',
    company_effectif: 0,
    company_ca_annuel: 0,
    // Mémoire technique
    company_description: '',
    company_human_resources: '',
    company_material_resources: '',
    company_methodology: '',
    company_quality_commitments: '',
  });

  // Certifications
  const [certifications, setCertifications] = useState<CompanyCertification[]>([]);
  const [newCertification, setNewCertification] = useState<Partial<CompanyCertification>>({});
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [editingCertIndex, setEditingCertIndex] = useState<number | null>(null);

  // Références
  const [references, setReferences] = useState<CompanyReference[]>([]);
  const [newReference, setNewReference] = useState<Partial<CompanyReference>>({});
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [editingRefIndex, setEditingRefIndex] = useState<number | null>(null);

  // Documents
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [newDocument, setNewDocument] = useState<Partial<CompanyDocument>>({});
  const [docDialogOpen, setDocDialogOpen] = useState(false);

  // SIRET Lookup
  const [siretLookupLoading, setSiretLookupLoading] = useState(false);
  const [siretLookupResult, setSiretLookupResult] = useState<CompanyLookupResult | null>(null);

  // AI Text Optimization
  const [optimizingField, setOptimizingField] = useState<OptimizationType | null>(null);

  // Structured Resources from database
  const [companyMaterials, setCompanyMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // Material dialog state
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [selectedMaterialCategory, setSelectedMaterialCategory] = useState<MaterialCategory>('vehicules');
  const [newMaterial, setNewMaterial] = useState<Partial<MaterialResource>>({
    category: 'vehicules',
    type: '',
    name: '',
    brand: '',
    model: '',
    quantity: 1,
    isOwned: true,
    yearAcquisition: new Date().getFullYear(),
  });

  // AI Material Recognition state
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<MaterialRecognitionResult | null>(null);
  const [materialImagePreview, setMaterialImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Charger les données du profil
  useEffect(() => {
    if (user?.id) {
      loadProfile();
      loadMaterials();
    }
  }, [user?.id]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          company: data.company || '',
          company_siret: data.company_siret || '',
          company_address: data.company_address || '',
          company_code_ape: data.company_code_ape || '',
          company_rcs: data.company_rcs || '',
          company_capital: data.company_capital || '',
          company_creation_date: data.company_creation_date || '',
          company_effectif: data.company_effectif || 0,
          company_ca_annuel: data.company_ca_annuel || 0,
          company_description: data.company_description || '',
          company_human_resources: data.company_human_resources || '',
          company_material_resources: data.company_material_resources || '',
          company_methodology: data.company_methodology || '',
          company_quality_commitments: data.company_quality_commitments || '',
        });
        setCertifications(Array.isArray(data.company_certifications) ? data.company_certifications : []);
        setReferences(Array.isArray(data.company_references) ? data.company_references : []);
        setDocuments(Array.isArray(data.company_documents) ? data.company_documents : []);
      }
    } catch (error) {
      console.error('[ProCompanyProfile] Erreur chargement:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger le profil entreprise.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Charger les matériels depuis la base
  const loadMaterials = async () => {
    try {
      setMaterialsLoading(true);
      const { data, error } = await supabase
        .from('company_materials')
        .select('*')
        .eq('owner_id', user!.id)
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) throw error;
      setCompanyMaterials(data || []);
    } catch (error) {
      console.error('[ProCompanyProfile] Erreur chargement matériels:', error);
      // Ne pas afficher d'erreur si la table n'existe pas encore
    } finally {
      setMaterialsLoading(false);
    }
  };

  // Calculer le pourcentage de complétion
  const calculateCompletion = useCallback(() => {
    let filled = 0;
    const total = 10;

    if (formData.company) filled++;
    if (formData.company_siret) filled++;
    if (formData.company_description) filled++;
    if (formData.company_human_resources) filled++;
    if (formData.company_material_resources) filled++;
    if (formData.company_methodology) filled++;
    if (formData.company_quality_commitments) filled++;
    if (certifications.length > 0) filled++;
    if (references.length > 0) filled++;
    if (documents.length > 0) filled++;

    return Math.round((filled / total) * 100);
  }, [formData, certifications, references, documents]);

  // Sauvegarder le profil
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          ...formData,
          company_certifications: certifications,
          company_references: references,
          company_documents: documents,
        })
        .eq('id', user!.id);

      if (error) throw error;

      // Mettre à jour le contexte local
      if (user) {
        setUser({
          ...user,
          ...formData,
          company_certifications: certifications,
          company_references: references,
          company_documents: documents,
        });
      }

      toast({
        title: 'Profil mis à jour',
        description: 'Les informations de votre entreprise ont été sauvegardées.',
      });
    } catch (error) {
      console.error('[ProCompanyProfile] Erreur sauvegarde:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder le profil.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Ajouter/Modifier une certification
  const handleSaveCertification = () => {
    if (!newCertification.type || !newCertification.name) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez remplir le type et le nom de la certification.',
      });
      return;
    }

    const cert: CompanyCertification = {
      type: newCertification.type,
      name: newCertification.name,
      number: newCertification.number,
      issuer: newCertification.issuer,
      issue_date: newCertification.issue_date,
      expiry_date: newCertification.expiry_date,
      is_valid: true,
    };

    if (editingCertIndex !== null) {
      const updated = [...certifications];
      updated[editingCertIndex] = cert;
      setCertifications(updated);
    } else {
      setCertifications([...certifications, cert]);
    }

    setNewCertification({});
    setCertDialogOpen(false);
    setEditingCertIndex(null);
  };

  const handleEditCertification = (index: number) => {
    setNewCertification(certifications[index]);
    setEditingCertIndex(index);
    setCertDialogOpen(true);
  };

  const handleDeleteCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  // ============================================
  // SIRET LOOKUP
  // ============================================

  const handleSiretLookup = async () => {
    const siret = formData.company_siret.replace(/\s/g, '');
    if (!siret || siret.length < 14) {
      toast({
        variant: 'destructive',
        title: 'SIRET invalide',
        description: 'Veuillez saisir un numéro SIRET complet (14 chiffres).',
      });
      return;
    }

    setSiretLookupLoading(true);
    try {
      const result = await SiretLookupService.lookupBySiret(siret);
      setSiretLookupResult(result);

      // Auto-remplir les champs
      setFormData(prev => ({
        ...prev,
        company: result.raisonSociale || prev.company,
        company_siret: SiretLookupService.formatSiret(siret),
        company_code_ape: result.codeApe || prev.company_code_ape,
        company_capital: result.capital ? result.capital.toString() : prev.company_capital,
        company_creation_date: result.dateCreation || prev.company_creation_date,
        company_effectif: result.effectifMax || prev.company_effectif,
        company_address: result.adresse?.complete || prev.company_address,
        company_rcs: result.rcs || prev.company_rcs,
      }));

      toast({
        title: 'Informations récupérées',
        description: `Données de ${result.raisonSociale} importées avec succès.`,
      });
    } catch (error: any) {
      console.error('[SiretLookup] Error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de recherche',
        description: error.message || 'Impossible de récupérer les informations.',
      });
    } finally {
      setSiretLookupLoading(false);
    }
  };

  // ============================================
  // AI TEXT OPTIMIZATION
  // ============================================

  const handleOptimizeText = async (field: OptimizationType) => {
    const fieldMap: Record<OptimizationType, keyof typeof formData> = {
      company_description: 'company_description',
      human_resources: 'company_human_resources',
      material_resources: 'company_material_resources',
      methodology: 'company_methodology',
      quality_commitments: 'company_quality_commitments',
    };

    const currentText = formData[fieldMap[field]];
    if (!currentText || currentText.length < 20) {
      toast({
        variant: 'destructive',
        title: 'Texte trop court',
        description: 'Veuillez d\'abord rédiger un texte (minimum 20 caractères) avant de l\'optimiser.',
      });
      return;
    }

    setOptimizingField(field);
    try {
      const result = await TextOptimizerService.optimizeText(currentText, field, {
        companyName: formData.company,
        activity: formData.company_code_ape,
        certifications: certifications.map(c => c.name),
      });

      setFormData(prev => ({
        ...prev,
        [fieldMap[field]]: result.optimizedText,
      }));

      toast({
        title: 'Texte optimisé',
        description: result.improvements.length > 0
          ? `Améliorations: ${result.improvements.join(', ')}`
          : 'Le texte a été optimisé avec succès.',
      });
    } catch (error: any) {
      console.error('[TextOptimizer] Error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur d\'optimisation',
        description: error.message || 'Impossible d\'optimiser le texte.',
      });
    } finally {
      setOptimizingField(null);
    }
  };

  // ============================================
  // STRUCTURED RESOURCES
  // ============================================

  const getTotalEffectif = () => {
    return employeeRoles.reduce((sum, role) => sum + role.count, 0);
  };

  const getTotalMaterial = () => {
    return materialResources.reduce((sum, m) => sum + m.quantity, 0);
  };

  // Ajouter/Modifier une référence
  const handleSaveReference = () => {
    if (!newReference.project_name) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez renseigner le nom du projet.',
      });
      return;
    }

    const ref: CompanyReference = {
      project_name: newReference.project_name,
      client_name: newReference.client_name,
      description: newReference.description,
      amount: newReference.amount,
      year: newReference.year,
      duration_months: newReference.duration_months,
      contact_name: newReference.contact_name,
      contact_phone: newReference.contact_phone,
      contact_email: newReference.contact_email,
    };

    if (editingRefIndex !== null) {
      const updated = [...references];
      updated[editingRefIndex] = ref;
      setReferences(updated);
    } else {
      setReferences([...references, ref]);
    }

    setNewReference({});
    setRefDialogOpen(false);
    setEditingRefIndex(null);
  };

  const handleEditReference = (index: number) => {
    setNewReference(references[index]);
    setEditingRefIndex(index);
    setRefDialogOpen(true);
  };

  const handleDeleteReference = (index: number) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  // Ajouter un document
  const handleSaveDocument = () => {
    if (!newDocument.type || !newDocument.name) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez remplir le type et le nom du document.',
      });
      return;
    }

    const doc: CompanyDocument = {
      type: newDocument.type,
      name: newDocument.name,
      file_url: newDocument.file_url,
      issue_date: newDocument.issue_date,
      expiry_date: newDocument.expiry_date,
      is_valid: true,
    };

    setDocuments([...documents, doc]);
    setNewDocument({});
    setDocDialogOpen(false);
  };

  const handleDeleteDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  // ============================================
  // MATERIAL MANAGEMENT
  // ============================================

  const openMaterialDialog = (category: MaterialCategory) => {
    setSelectedMaterialCategory(category);
    setEditingMaterial(null);
    setNewMaterial({
      category,
      type: '',
      name: '',
      brand: '',
      model: '',
      quantity: 1,
      isOwned: true,
      yearAcquisition: new Date().getFullYear(),
    });
    setMaterialDialogOpen(true);
  };

  const handleEditMaterial = (material: any) => {
    setEditingMaterial(material);
    setSelectedMaterialCategory(material.category);
    setNewMaterial({
      category: material.category,
      type: material.type,
      name: material.name || '',
      brand: material.brand || '',
      model: material.model || '',
      quantity: material.quantity || 1,
      isOwned: material.is_owned ?? true,
      yearAcquisition: material.year_acquisition,
      value: material.purchase_value,
      notes: material.notes || '',
    });
    setMaterialDialogOpen(true);
  };

  const handleSaveMaterial = async () => {
    if (!newMaterial.type) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un type de matériel.',
      });
      return;
    }

    try {
      const materialData = {
        category: newMaterial.category,
        type: newMaterial.type,
        name: newMaterial.name || null,
        brand: newMaterial.brand || null,
        model: newMaterial.model || null,
        quantity: newMaterial.quantity || 1,
        is_owned: newMaterial.isOwned ?? true,
        year_acquisition: newMaterial.yearAcquisition || null,
        purchase_value: newMaterial.value || null,
        notes: newMaterial.notes || null,
      };

      if (editingMaterial) {
        const { error } = await supabase
          .from('company_materials')
          .update(materialData)
          .eq('id', editingMaterial.id);

        if (error) throw error;
        toast({
          title: 'Matériel modifié',
          description: `${newMaterial.type} a été mis à jour.`,
        });
      } else {
        const { error } = await supabase.from('company_materials').insert({
          ...materialData,
          owner_id: user!.id,
        });

        if (error) throw error;
        toast({
          title: 'Matériel ajouté',
          description: `${newMaterial.type} a été ajouté au parc.`,
        });
      }

      setMaterialDialogOpen(false);
      loadMaterials();
    } catch (error) {
      console.error('[ProCompanyProfile] Erreur sauvegarde matériel:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder le matériel.',
      });
    }
  };

  const handleDeleteMaterial = async (material: any) => {
    if (!confirm(`Supprimer ${material.type} ${material.name || ''} du parc ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('company_materials')
        .update({ is_active: false })
        .eq('id', material.id);

      if (error) throw error;

      toast({
        title: 'Matériel supprimé',
        description: `${material.type} a été retiré du parc.`,
      });

      loadMaterials();
    } catch (error) {
      console.error('[ProCompanyProfile] Erreur suppression matériel:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer le matériel.',
      });
    }
  };

  // Statistiques matériel par catégorie
  const getMaterialStats = () => {
    const stats: Record<MaterialCategory, number> = {
      vehicules: 0,
      engins: 0,
      outillage: 0,
      equipements: 0,
      informatique: 0,
      locaux: 0,
    };

    companyMaterials.forEach((m) => {
      if (stats[m.category as MaterialCategory] !== undefined) {
        stats[m.category as MaterialCategory] += m.quantity || 1;
      }
    });

    return stats;
  };

  // ============================================
  // AI MATERIAL RECOGNITION
  // ============================================

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Valider le fichier
    const validation = MaterialRecognitionService.validateFile(file);
    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: 'Fichier invalide',
        description: validation.error,
      });
      return;
    }

    // Afficher la preview
    const previewUrl = URL.createObjectURL(file);
    setMaterialImagePreview(previewUrl);

    // Lancer la reconnaissance
    await recognizeMaterial(file);
  };

  const handleCameraCapture = async () => {
    try {
      const file = await MaterialRecognitionService.captureFromCamera();

      // Afficher la preview
      const previewUrl = URL.createObjectURL(file);
      setMaterialImagePreview(previewUrl);

      // Lancer la reconnaissance
      await recognizeMaterial(file);
    } catch (error) {
      console.error('[MaterialRecognition] Camera error:', error);
    }
  };

  const recognizeMaterial = async (file: File) => {
    setRecognizing(true);
    setRecognitionResult(null);

    try {
      const result = await MaterialRecognitionService.recognizeFromFile(file, {
        context: 'Matériel professionnel BTP pour entreprise du bâtiment',
      });

      setRecognitionResult(result);

      if (result.success && result.confidence > 0.5) {
        // Mapper les résultats vers le formulaire
        const mappedData = MaterialRecognitionService.mapToMaterialForm(result);

        setNewMaterial((prev) => ({
          ...prev,
          ...mappedData,
        }));

        setSelectedMaterialCategory(mappedData.category);

        toast({
          title: 'Matériel identifié !',
          description: `${result.type}${result.brand ? ` - ${result.brand}` : ''} (${Math.round(result.confidence * 100)}% confiance)`,
        });
      } else {
        toast({
          variant: 'default',
          title: 'Identification partielle',
          description: result.rawDescription || 'Le matériel n\'a pas pu être identifié avec certitude.',
        });
      }
    } catch (error: any) {
      console.error('[MaterialRecognition] Error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de reconnaissance',
        description: error.message || 'Impossible d\'analyser l\'image.',
      });
    } finally {
      setRecognizing(false);
    }
  };

  const clearRecognitionPreview = () => {
    if (materialImagePreview) {
      URL.revokeObjectURL(materialImagePreview);
    }
    setMaterialImagePreview(null);
    setRecognitionResult(null);
  };

  // Reset recognition state when dialog closes
  const handleMaterialDialogChange = (open: boolean) => {
    setMaterialDialogOpen(open);
    if (!open) {
      clearRecognitionPreview();
    }
  };

  if (loading) {
    return (
      <ProLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProLayout>
    );
  }

  const completion = calculateCompletion();

  return (
    <ProLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Profil entreprise
            </h1>
            <p className="text-muted-foreground mt-1">
              Renseignez les informations de votre entreprise pour pré-remplir vos offres
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>

        {/* Barre de progression */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Complétion du profil</span>
              <span className="text-sm font-bold text-primary">{completion}%</span>
            </div>
            <Progress value={completion} className="h-2" />
            {completion < 50 && (
              <Alert className="mt-4" variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Complétez votre profil pour pré-remplir automatiquement vos offres B2B
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="presentation" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden md:inline">Présentation</span>
            </TabsTrigger>
            <TabsTrigger value="moyens" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden md:inline">Moyens</span>
            </TabsTrigger>
            <TabsTrigger value="certifications" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden md:inline">Certifications</span>
            </TabsTrigger>
            <TabsTrigger value="references" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden md:inline">Références</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden md:inline">Documents</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Présentation */}
          <TabsContent value="presentation" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Identification de l'entreprise</CardTitle>
                <CardDescription>
                  Informations légales et administratives
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Alert si données récupérées du SIRET */}
                {siretLookupResult && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      Données importées de <strong>{siretLookupResult.raisonSociale}</strong>
                      {siretLookupResult.estActif ? ' (Entreprise active)' : ' (Entreprise inactive)'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SIRET avec bouton de recherche */}
                  <div className="md:col-span-2">
                    <Label htmlFor="siret">SIRET *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="siret"
                        value={formData.company_siret}
                        onChange={(e) => setFormData({ ...formData, company_siret: e.target.value })}
                        placeholder="123 456 789 00012"
                        maxLength={17}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSiretLookup}
                        disabled={siretLookupLoading || !formData.company_siret}
                      >
                        {siretLookupLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Rechercher</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Saisissez votre SIRET et cliquez sur Rechercher pour auto-compléter les informations
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="company">Raison sociale *</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Nom de l'entreprise"
                    />
                  </div>
                  <div>
                    <Label htmlFor="code_ape">Code APE</Label>
                    <Input
                      id="code_ape"
                      value={formData.company_code_ape}
                      onChange={(e) => setFormData({ ...formData, company_code_ape: e.target.value })}
                      placeholder="4321A"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rcs">RCS</Label>
                    <Input
                      id="rcs"
                      value={formData.company_rcs}
                      onChange={(e) => setFormData({ ...formData, company_rcs: e.target.value })}
                      placeholder="Paris B 123 456 789"
                    />
                  </div>
                  <div>
                    <Label htmlFor="capital">Capital social</Label>
                    <Input
                      id="capital"
                      value={formData.company_capital}
                      onChange={(e) => setFormData({ ...formData, company_capital: e.target.value })}
                      placeholder="10 000 €"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Adresse du siège</Label>
                    <Input
                      id="address"
                      value={formData.company_address}
                      onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                      placeholder="123 rue de l'Exemple, 75001 Paris"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creation_date">Date de création</Label>
                    <Input
                      id="creation_date"
                      type="date"
                      value={formData.company_creation_date}
                      onChange={(e) => setFormData({ ...formData, company_creation_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="effectif">Effectif</Label>
                    <Input
                      id="effectif"
                      type="number"
                      value={formData.company_effectif || ''}
                      onChange={(e) => setFormData({ ...formData, company_effectif: parseInt(e.target.value) || 0 })}
                      placeholder="15"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ca_annuel">CA annuel (€)</Label>
                    <Input
                      id="ca_annuel"
                      type="number"
                      value={formData.company_ca_annuel || ''}
                      onChange={(e) => setFormData({ ...formData, company_ca_annuel: parseFloat(e.target.value) || 0 })}
                      placeholder="500000"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Présentation de l'entreprise</CardTitle>
                    <CardDescription>
                      Description détaillée pour vos mémoires techniques
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOptimizeText('company_description')}
                    disabled={optimizingField === 'company_description' || !formData.company_description}
                  >
                    {optimizingField === 'company_description' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Optimiser avec l'IA
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.company_description}
                  onChange={(e) => setFormData({ ...formData, company_description: e.target.value })}
                  placeholder="Décrivez votre entreprise, son historique, ses compétences clés, ses domaines d'expertise..."
                  rows={6}
                />
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  <span>Suggestions : historique, domaines d'expertise, zone d'intervention, valeurs, chiffres clés</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Moyens */}
          <TabsContent value="moyens" className="space-y-6 mt-6">
            {/* Section Moyens humains avec lien vers Mon équipe */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>Moyens humains</CardTitle>
                      <CardDescription>
                        Décrivez vos équipes et leurs compétences
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOptimizeText('human_resources')}
                      disabled={optimizingField === 'human_resources' || !formData.company_human_resources}
                    >
                      {optimizingField === 'human_resources' ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Optimiser
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/pro/team">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Mon équipe
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Boutons rapides pour ajouter des profils types */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(EMPLOYEE_CATEGORIES).map(([key, config]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      asChild
                    >
                      <Link to="/pro/team">
                        <HardHat className="h-3 w-3 mr-1" />
                        + {config.label}
                      </Link>
                    </Button>
                  ))}
                </div>

                {/* Texte descriptif */}
                <Textarea
                  value={formData.company_human_resources}
                  onChange={(e) => setFormData({ ...formData, company_human_resources: e.target.value })}
                  placeholder="Ex: Notre équipe se compose de 15 collaborateurs dont :&#10;- 2 conducteurs de travaux&#10;- 8 ouvriers qualifiés (électriciens, plombiers, maçons)&#10;- 3 apprentis&#10;- 2 administratifs&#10;&#10;Tous nos techniciens sont habilités et formés régulièrement..."
                  rows={6}
                />

                {/* Lien vers la gestion détaillée */}
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      Gérez les fiches détaillées de vos employés dans la section "Mon équipe"
                    </span>
                    <Button variant="link" size="sm" asChild>
                      <Link to="/pro/team">Gérer mon équipe →</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Section Moyens matériels */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Truck className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle>Moyens matériels</CardTitle>
                      <CardDescription>
                        Gérez votre parc de véhicules, engins et équipements
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOptimizeText('material_resources')}
                    disabled={optimizingField === 'material_resources' || !formData.company_material_resources}
                  >
                    {optimizingField === 'material_resources' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Optimiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Boutons rapides pour types de matériel - Cliquables */}
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(MATERIAL_CATEGORIES) as [MaterialCategory, { label: string; color: string; icon: string }][]).map(([key, config]) => {
                    const count = getMaterialStats()[key];
                    return (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-2"
                        onClick={() => openMaterialDialog(key)}
                      >
                        <Plus className="h-3 w-3" />
                        {config.label}
                        {count > 0 && (
                          <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                            {count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>

                {/* Liste des matériels ajoutés */}
                {companyMaterials.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {companyMaterials.map((material) => (
                      <div key={material.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${MATERIAL_CATEGORIES[material.category as MaterialCategory]?.color || 'gray'}-100`}>
                            <Truck className={`h-4 w-4 text-${MATERIAL_CATEGORIES[material.category as MaterialCategory]?.color || 'gray'}-600`} />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {material.type}
                              {material.name && ` - ${material.name}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {MATERIAL_CATEGORIES[material.category as MaterialCategory]?.label}
                              {material.brand && ` • ${material.brand}`}
                              {material.model && ` ${material.model}`}
                              {material.quantity > 1 && ` • Qté: ${material.quantity}`}
                              {material.is_owned === false && ' • Location'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditMaterial(material)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteMaterial(material)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Description textuelle pour le mémoire technique */}
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Description pour mémoire technique (générée automatiquement ou personnalisée)
                  </Label>
                  <Textarea
                    value={formData.company_material_resources}
                    onChange={(e) => setFormData({ ...formData, company_material_resources: e.target.value })}
                    placeholder="Ex: Notre parc matériel comprend :&#10;- 5 véhicules utilitaires (fourgons Renault Master)&#10;- 1 nacelle élévatrice (12m)&#10;- 2 mini-pelles (3T)&#10;- Outillage professionnel complet&#10;- Équipements de sécurité (EPI, balisage...)&#10;&#10;Matériel entretenu et contrôlé régulièrement..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dialog ajout/modification matériel */}
            <Dialog open={materialDialogOpen} onOpenChange={handleMaterialDialogChange}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingMaterial ? 'Modifier le matériel' : `Ajouter - ${MATERIAL_CATEGORIES[selectedMaterialCategory]?.label}`}
                  </DialogTitle>
                  <DialogDescription>
                    Prenez une photo ou renseignez les informations manuellement
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Section reconnaissance photo IA */}
                  {!editingMaterial && (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <ScanLine className="h-4 w-4" />
                        Identification automatique
                      </Label>

                      {/* Zone de preview/upload */}
                      {materialImagePreview ? (
                        <div className="relative">
                          <img
                            src={materialImagePreview}
                            alt="Preview"
                            className="w-full h-40 object-cover rounded-lg border"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={clearRecognitionPreview}
                            disabled={recognizing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          {recognizing && (
                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                              <div className="text-center text-white">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                <span className="text-sm">Analyse en cours...</span>
                              </div>
                            </div>
                          )}
                          {recognitionResult && recognitionResult.success && (
                            <div className="absolute bottom-2 left-2 right-2">
                              <Badge variant="secondary" className="bg-green-500/90 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {Math.round(recognitionResult.confidence * 100)}% confiance
                              </Badge>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex justify-center gap-4">
                            {/* Bouton Caméra */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCameraCapture}
                              disabled={recognizing}
                              className="flex-col h-auto py-3 px-4"
                            >
                              <Camera className="h-6 w-6 mb-1" />
                              <span className="text-xs">Photo</span>
                            </Button>

                            {/* Bouton Upload */}
                            <label className="cursor-pointer">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={recognizing}
                                className="flex-col h-auto py-3 px-4 pointer-events-none"
                                asChild
                              >
                                <span>
                                  <ImagePlus className="h-6 w-6 mb-1" />
                                  <span className="text-xs">Importer</span>
                                </span>
                              </Button>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                                disabled={recognizing}
                              />
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            L'IA identifiera automatiquement le matériel
                          </p>
                        </div>
                      )}

                      {/* Résultat de la reconnaissance */}
                      {recognitionResult && recognitionResult.success && (
                        <Alert className="bg-green-50 border-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-700 text-sm">
                            <strong>{recognitionResult.type}</strong>
                            {recognitionResult.brand && ` - ${recognitionResult.brand}`}
                            {recognitionResult.model && ` ${recognitionResult.model}`}
                            {recognitionResult.estimatedValue && (
                              <span className="block mt-1 text-xs">
                                Valeur estimée: {recognitionResult.estimatedValue.min.toLocaleString('fr-FR')} - {recognitionResult.estimatedValue.max.toLocaleString('fr-FR')} €
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            ou saisie manuelle
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Catégorie */}
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select
                      value={newMaterial.category}
                      onValueChange={(value) => setNewMaterial({ ...newMaterial, category: value as MaterialCategory, type: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(MATERIAL_CATEGORIES) as [MaterialCategory, { label: string }][]).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Type de matériel */}
                  <div className="space-y-2">
                    <Label>Type de matériel *</Label>
                    <Select
                      value={newMaterial.type || ''}
                      onValueChange={(value) => setNewMaterial({ ...newMaterial, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_MATERIAL_TYPES[newMaterial.category as MaterialCategory]?.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">Autre (personnalisé)</SelectItem>
                      </SelectContent>
                    </Select>
                    {newMaterial.type === '__custom__' && (
                      <Input
                        placeholder="Nom du matériel..."
                        onChange={(e) => setNewMaterial({ ...newMaterial, type: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Nom / Marque / Modèle */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        value={newMaterial.name || ''}
                        onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                        placeholder="Ex: Fourgon 1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Marque</Label>
                      <Input
                        value={newMaterial.brand || ''}
                        onChange={(e) => setNewMaterial({ ...newMaterial, brand: e.target.value })}
                        placeholder="Ex: Renault"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Modèle</Label>
                      <Input
                        value={newMaterial.model || ''}
                        onChange={(e) => setNewMaterial({ ...newMaterial, model: e.target.value })}
                        placeholder="Ex: Master"
                      />
                    </div>
                  </div>

                  {/* Quantité et Propriété */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantité</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newMaterial.quantity || 1}
                        onChange={(e) => setNewMaterial({ ...newMaterial, quantity: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Propriété</Label>
                      <Select
                        value={newMaterial.isOwned ? 'owned' : 'rental'}
                        onValueChange={(value) => setNewMaterial({ ...newMaterial, isOwned: value === 'owned' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owned">Propriété</SelectItem>
                          <SelectItem value="rental">Location / Leasing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Année et Valeur */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Année d'acquisition</Label>
                      <Input
                        type="number"
                        min={1990}
                        max={new Date().getFullYear()}
                        value={newMaterial.yearAcquisition || ''}
                        onChange={(e) => setNewMaterial({ ...newMaterial, yearAcquisition: parseInt(e.target.value) || undefined })}
                        placeholder={new Date().getFullYear().toString()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valeur (€)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newMaterial.value || ''}
                        onChange={(e) => setNewMaterial({ ...newMaterial, value: parseFloat(e.target.value) || undefined })}
                        placeholder="15000"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleSaveMaterial}>
                    {editingMaterial ? 'Modifier' : 'Ajouter'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Briefcase className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle>Méthodologie d'intervention</CardTitle>
                      <CardDescription>
                        Votre approche type sur les chantiers
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOptimizeText('methodology')}
                    disabled={optimizingField === 'methodology' || !formData.company_methodology}
                  >
                    {optimizingField === 'methodology' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Optimiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.company_methodology}
                  onChange={(e) => setFormData({ ...formData, company_methodology: e.target.value })}
                  placeholder="Ex: Notre méthodologie d'intervention s'articule autour de 5 phases :&#10;&#10;1. PRÉPARATION : Visite technique, analyse des contraintes, validation du planning&#10;2. INSTALLATION : Mise en place base-vie, sécurisation du site, protection des existants&#10;3. EXÉCUTION : Travaux suivant planning, contrôles qualité internes&#10;4. CONTRÔLE : Autocontrôle systématique, essais et mesures&#10;5. RÉCEPTION : Nettoyage, formation utilisateur, remise des DOE..."
                  rows={10}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Shield className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>Engagements qualité</CardTitle>
                      <CardDescription>
                        Vos garanties et certifications qualité
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOptimizeText('quality_commitments')}
                    disabled={optimizingField === 'quality_commitments' || !formData.company_quality_commitments}
                  >
                    {optimizingField === 'quality_commitments' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Optimiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.company_quality_commitments}
                  onChange={(e) => setFormData({ ...formData, company_quality_commitments: e.target.value })}
                  placeholder="Ex: Nos engagements qualité :&#10;&#10;- Respect des délais contractuels&#10;- Garantie décennale sur tous nos ouvrages&#10;- Traçabilité complète des matériaux&#10;- SAV réactif sous 48h&#10;- Formation continue de nos équipes&#10;- Démarche environnementale (tri déchets, produits éco-responsables)..."
                  rows={8}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Certifications */}
          <TabsContent value="certifications" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Certifications et qualifications
                  </CardTitle>
                  <CardDescription>
                    RGE, Qualibat, ISO, etc.
                  </CardDescription>
                </div>
                <Dialog open={certDialogOpen} onOpenChange={(open) => {
                  setCertDialogOpen(open);
                  if (!open) {
                    setNewCertification({});
                    setEditingCertIndex(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingCertIndex !== null ? 'Modifier la certification' : 'Ajouter une certification'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Type de certification *</Label>
                        <Select
                          value={newCertification.type || ''}
                          onValueChange={(value) => setNewCertification({ ...newCertification, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CERTIFICATION_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nom / Intitulé *</Label>
                        <Input
                          value={newCertification.name || ''}
                          onChange={(e) => setNewCertification({ ...newCertification, name: e.target.value })}
                          placeholder="Ex: RGE Qualibat 5112"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Numéro</Label>
                          <Input
                            value={newCertification.number || ''}
                            onChange={(e) => setNewCertification({ ...newCertification, number: e.target.value })}
                            placeholder="Ex: 123456"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Organisme</Label>
                          <Input
                            value={newCertification.issuer || ''}
                            onChange={(e) => setNewCertification({ ...newCertification, issuer: e.target.value })}
                            placeholder="Ex: Qualibat"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date d'obtention</Label>
                          <Input
                            type="date"
                            value={newCertification.issue_date || ''}
                            onChange={(e) => setNewCertification({ ...newCertification, issue_date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Date d'expiration</Label>
                          <Input
                            type="date"
                            value={newCertification.expiry_date || ''}
                            onChange={(e) => setNewCertification({ ...newCertification, expiry_date: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCertDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleSaveCertification}>
                        {editingCertIndex !== null ? 'Modifier' : 'Ajouter'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {certifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune certification ajoutée</p>
                    <p className="text-sm">Ajoutez vos qualifications RGE, Qualibat, etc.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {certifications.map((cert, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Award className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{cert.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {CERTIFICATION_TYPES.find(t => t.value === cert.type)?.label || cert.type}
                              {cert.number && ` - N°${cert.number}`}
                            </div>
                            {cert.expiry_date && (
                              <div className="text-xs text-muted-foreground">
                                Expire le {new Date(cert.expiry_date).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cert.is_valid ? 'default' : 'destructive'}>
                            {cert.is_valid ? 'Valide' : 'Expiré'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCertification(index)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteCertification(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Références */}
          <TabsContent value="references" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Références chantiers
                  </CardTitle>
                  <CardDescription>
                    Projets similaires réalisés
                  </CardDescription>
                </div>
                <Dialog open={refDialogOpen} onOpenChange={(open) => {
                  setRefDialogOpen(open);
                  if (!open) {
                    setNewReference({});
                    setEditingRefIndex(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingRefIndex !== null ? 'Modifier la référence' : 'Ajouter une référence'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                          <Label>Nom du projet *</Label>
                          <Input
                            value={newReference.project_name || ''}
                            onChange={(e) => setNewReference({ ...newReference, project_name: e.target.value })}
                            placeholder="Ex: Rénovation bureaux Paris 15"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Client</Label>
                          <Input
                            value={newReference.client_name || ''}
                            onChange={(e) => setNewReference({ ...newReference, client_name: e.target.value })}
                            placeholder="Ex: SCI Immobilier"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Année</Label>
                          <Input
                            type="number"
                            value={newReference.year || ''}
                            onChange={(e) => setNewReference({ ...newReference, year: parseInt(e.target.value) || undefined })}
                            placeholder="2024"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Montant (€ HT)</Label>
                          <Input
                            type="number"
                            value={newReference.amount || ''}
                            onChange={(e) => setNewReference({ ...newReference, amount: parseFloat(e.target.value) || undefined })}
                            placeholder="150000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Durée (mois)</Label>
                          <Input
                            type="number"
                            value={newReference.duration_months || ''}
                            onChange={(e) => setNewReference({ ...newReference, duration_months: parseInt(e.target.value) || undefined })}
                            placeholder="6"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Description des travaux</Label>
                        <Textarea
                          value={newReference.description || ''}
                          onChange={(e) => setNewReference({ ...newReference, description: e.target.value })}
                          placeholder="Décrivez les travaux réalisés..."
                          rows={3}
                        />
                      </div>
                      <div className="border-t pt-4">
                        <Label className="text-sm font-medium">Contact référent (optionnel)</Label>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <div className="space-y-2">
                            <Label className="text-xs">Nom</Label>
                            <Input
                              value={newReference.contact_name || ''}
                              onChange={(e) => setNewReference({ ...newReference, contact_name: e.target.value })}
                              placeholder="M. Dupont"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Téléphone</Label>
                            <Input
                              value={newReference.contact_phone || ''}
                              onChange={(e) => setNewReference({ ...newReference, contact_phone: e.target.value })}
                              placeholder="01 23 45 67 89"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Email</Label>
                            <Input
                              value={newReference.contact_email || ''}
                              onChange={(e) => setNewReference({ ...newReference, contact_email: e.target.value })}
                              placeholder="contact@client.fr"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRefDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleSaveReference}>
                        {editingRefIndex !== null ? 'Modifier' : 'Ajouter'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {references.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune référence ajoutée</p>
                    <p className="text-sm">Ajoutez vos chantiers de référence</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {references.map((ref, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{ref.project_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {ref.client_name && `${ref.client_name} • `}
                              {ref.year && `${ref.year} • `}
                              {ref.amount && `${ref.amount.toLocaleString('fr-FR')} € HT`}
                              {ref.duration_months && ` • ${ref.duration_months} mois`}
                            </div>
                            {ref.description && (
                              <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
                                {ref.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditReference(index)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteReference(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Documents */}
          <TabsContent value="documents" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents administratifs
                  </CardTitle>
                  <CardDescription>
                    Kbis, attestations, certificats
                  </CardDescription>
                </div>
                <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ajouter un document</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Type de document *</Label>
                        <Select
                          value={newDocument.type || ''}
                          onValueChange={(value) => setNewDocument({ ...newDocument, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nom du document *</Label>
                        <Input
                          value={newDocument.name || ''}
                          onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                          placeholder="Ex: Attestation décennale 2024"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date d'émission</Label>
                          <Input
                            type="date"
                            value={newDocument.issue_date || ''}
                            onChange={(e) => setNewDocument({ ...newDocument, issue_date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Date d'expiration</Label>
                          <Input
                            type="date"
                            value={newDocument.expiry_date || ''}
                            onChange={(e) => setNewDocument({ ...newDocument, expiry_date: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Fichier</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Upload à implémenter (drag & drop ou clic)
                          </p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleSaveDocument}>
                        Ajouter
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun document ajouté</p>
                    <p className="text-sm">Ajoutez vos documents administratifs (Kbis, attestations...)</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{doc.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                            </div>
                            {doc.expiry_date && (
                              <div className="text-xs text-muted-foreground">
                                Expire le {new Date(doc.expiry_date).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.expiry_date && new Date(doc.expiry_date) < new Date() ? (
                            <Badge variant="destructive">Expiré</Badge>
                          ) : doc.expiry_date && new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              Expire bientôt
                            </Badge>
                          ) : (
                            <Badge variant="default">Valide</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteDocument(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {documents.length > 0 && (
                  <Alert className="mt-4">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Ces documents seront automatiquement joints à vos offres B2B
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProLayout>
  );
}
