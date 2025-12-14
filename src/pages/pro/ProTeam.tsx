/**
 * ProTeam Page
 * Gestion des employés de l'entreprise B2B
 * - Liste des employés
 * - Ajout/modification/suppression
 * - Qualifications et habilitations
 * - Affectation aux projets
 */

import { useState, useEffect } from 'react';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Briefcase,
  Award,
  Shield,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

// Types
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  job_title: string;
  department?: string;
  is_manager: boolean;
  hire_date?: string;
  qualifications: string[];
  certifications: string[];
  habilitations: string[];
  skills: string[];
  experience_years?: number;
  availability_status: 'available' | 'busy' | 'on_leave' | 'unavailable';
  current_project_id?: string;
  avatar_url?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

// Statuts de disponibilité
const AVAILABILITY_STATUS = {
  available: { label: 'Disponible', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  busy: { label: 'Occupé', color: 'bg-orange-100 text-orange-700', icon: Clock },
  on_leave: { label: 'En congé', color: 'bg-blue-100 text-blue-700', icon: Calendar },
  unavailable: { label: 'Indisponible', color: 'bg-red-100 text-red-700', icon: XCircle },
};

// Types de qualifications courantes
const COMMON_QUALIFICATIONS = [
  'CAP Électricien',
  'CAP Plombier',
  'CAP Maçon',
  'CAP Menuisier',
  'CAP Peintre',
  'BP Électricien',
  'BP Plombier',
  'BTS Bâtiment',
  'BTS Électrotechnique',
  'Licence Pro Bâtiment',
  'Ingénieur Travaux',
];

// Types d'habilitations courantes
const COMMON_HABILITATIONS = [
  'Habilitation électrique B0',
  'Habilitation électrique B1',
  'Habilitation électrique B2',
  'Habilitation électrique BR',
  'Habilitation électrique BC',
  'Travail en hauteur',
  'CACES R489',
  'CACES R486',
  'CACES R482',
  'SST (Sauveteur Secouriste)',
  'AIPR (Réseaux)',
  'Manipulation extincteurs',
  'Amiante SS4',
  'Échafaudage',
];

export default function ProTeam() {
  const { user } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialog pour ajout/modification
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    department: '',
    is_manager: false,
    hire_date: '',
    qualifications: [],
    certifications: [],
    habilitations: [],
    skills: [],
    experience_years: 0,
    availability_status: 'available',
    notes: '',
    is_active: true,
  });

  // Charger les employés
  useEffect(() => {
    if (user?.id) {
      loadEmployees();
    }
  }, [user?.id]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('company_employees')
        .select('*')
        .eq('owner_id', user!.id)
        .order('last_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('[ProTeam] Erreur chargement:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les employés.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les employés
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      !searchQuery ||
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.job_title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && emp.is_active) ||
      (filterStatus === 'inactive' && !emp.is_active) ||
      emp.availability_status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Ouvrir le dialog pour ajouter
  const handleAdd = () => {
    setEditingEmployee(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_title: '',
      department: '',
      is_manager: false,
      hire_date: '',
      qualifications: [],
      certifications: [],
      habilitations: [],
      skills: [],
      experience_years: 0,
      availability_status: 'available',
      notes: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  // Ouvrir le dialog pour modifier
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email || '',
      phone: employee.phone || '',
      job_title: employee.job_title,
      department: employee.department || '',
      is_manager: employee.is_manager,
      hire_date: employee.hire_date || '',
      qualifications: employee.qualifications || [],
      certifications: employee.certifications || [],
      habilitations: employee.habilitations || [],
      skills: employee.skills || [],
      experience_years: employee.experience_years || 0,
      availability_status: employee.availability_status,
      notes: employee.notes || '',
      is_active: employee.is_active,
    });
    setDialogOpen(true);
  };

  // Sauvegarder
  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name || !formData.job_title) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez remplir les champs obligatoires (nom, prénom, poste).',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        // Modification
        const { error } = await supabase
          .from('company_employees')
          .update({
            ...formData,
          })
          .eq('id', editingEmployee.id);

        if (error) throw error;

        toast({
          title: 'Employé modifié',
          description: `${formData.first_name} ${formData.last_name} a été mis à jour.`,
        });
      } else {
        // Ajout
        const { error } = await supabase.from('company_employees').insert({
          ...formData,
          owner_id: user!.id,
        });

        if (error) throw error;

        toast({
          title: 'Employé ajouté',
          description: `${formData.first_name} ${formData.last_name} a été ajouté à l'équipe.`,
        });
      }

      setDialogOpen(false);
      loadEmployees();
    } catch (error) {
      console.error('[ProTeam] Erreur sauvegarde:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de sauvegarder.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Supprimer
  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Supprimer ${employee.first_name} ${employee.last_name} de l'équipe ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('company_employees')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: 'Employé supprimé',
        description: `${employee.first_name} ${employee.last_name} a été retiré de l'équipe.`,
      });

      loadEmployees();
    } catch (error) {
      console.error('[ProTeam] Erreur suppression:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer.',
      });
    }
  };

  // Changer le statut
  const handleChangeStatus = async (employee: Employee, newStatus: Employee['availability_status']) => {
    try {
      const { error } = await supabase
        .from('company_employees')
        .update({ availability_status: newStatus })
        .eq('id', employee.id);

      if (error) throw error;

      setEmployees(
        employees.map((e) =>
          e.id === employee.id ? { ...e, availability_status: newStatus } : e
        )
      );

      toast({
        title: 'Statut mis à jour',
        description: `${employee.first_name} est maintenant ${AVAILABILITY_STATUS[newStatus].label.toLowerCase()}.`,
      });
    } catch (error) {
      console.error('[ProTeam] Erreur changement statut:', error);
    }
  };

  // Ajouter une qualification/habilitation au formulaire
  const addToArray = (field: 'qualifications' | 'habilitations' | 'skills', value: string) => {
    if (!value || formData[field]?.includes(value)) return;
    setFormData({
      ...formData,
      [field]: [...(formData[field] || []), value],
    });
  };

  const removeFromArray = (field: 'qualifications' | 'habilitations' | 'skills', value: string) => {
    setFormData({
      ...formData,
      [field]: formData[field]?.filter((v) => v !== value) || [],
    });
  };

  // Statistiques
  const stats = {
    total: employees.length,
    available: employees.filter((e) => e.availability_status === 'available' && e.is_active).length,
    busy: employees.filter((e) => e.availability_status === 'busy' && e.is_active).length,
    managers: employees.filter((e) => e.is_manager && e.is_active).length,
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

  return (
    <ProLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Mon équipe
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez les membres de votre équipe et leurs affectations
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un employé
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? 'Modifier l\'employé' : 'Ajouter un employé'}
                </DialogTitle>
                <DialogDescription>
                  Renseignez les informations du collaborateur
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Identité */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="Jean"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Dupont"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jean.dupont@entreprise.fr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>

                {/* Poste */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Poste *</Label>
                    <Input
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      placeholder="Électricien, Chef de chantier..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service</Label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Production, Bureau d'études..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date d'embauche</Label>
                    <Input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expérience (années)</Label>
                    <Input
                      type="number"
                      value={formData.experience_years || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })
                      }
                      min={0}
                    />
                  </div>
                </div>

                {/* Statut */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Disponibilité</Label>
                    <Select
                      value={formData.availability_status}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          availability_status: value as Employee['availability_status'],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AVAILABILITY_STATUS).map(([key, status]) => (
                          <SelectItem key={key} value={key}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-8">
                    <input
                      type="checkbox"
                      id="is_manager"
                      checked={formData.is_manager}
                      onChange={(e) => setFormData({ ...formData, is_manager: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="is_manager">Responsable / Manager</Label>
                  </div>
                </div>

                {/* Qualifications */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Qualifications
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.qualifications?.map((q) => (
                      <Badge key={q} variant="secondary" className="gap-1">
                        {q}
                        <button
                          type="button"
                          onClick={() => removeFromArray('qualifications', q)}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Select onValueChange={(value) => addToArray('qualifications', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter une qualification..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_QUALIFICATIONS.filter(
                        (q) => !formData.qualifications?.includes(q)
                      ).map((q) => (
                        <SelectItem key={q} value={q}>
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Habilitations */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Habilitations
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.habilitations?.map((h) => (
                      <Badge key={h} variant="outline" className="gap-1">
                        {h}
                        <button
                          type="button"
                          onClick={() => removeFromArray('habilitations', h)}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Select onValueChange={(value) => addToArray('habilitations', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ajouter une habilitation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_HABILITATIONS.filter(
                        (h) => !formData.habilitations?.includes(h)
                      ).map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingEmployee ? 'Modifier' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Employés</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.available}</div>
                  <div className="text-sm text-muted-foreground">Disponibles</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.busy}</div>
                  <div className="text-sm text-muted-foreground">En mission</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.managers}</div>
                  <div className="text-sm text-muted-foreground">Responsables</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un employé..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="busy">Occupés</SelectItem>
              <SelectItem value="on_leave">En congé</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Liste des employés */}
        <Card>
          <CardContent className="p-0">
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {employees.length === 0 ? (
                  <>
                    <p className="font-medium">Aucun employé enregistré</p>
                    <p className="text-sm mt-1">
                      Ajoutez les membres de votre équipe pour les affecter aux projets
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Aucun résultat</p>
                    <p className="text-sm mt-1">Modifiez vos critères de recherche</p>
                  </>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Qualifications</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => {
                    const status = AVAILABILITY_STATUS[employee.availability_status];
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={employee.avatar_url} />
                              <AvatarFallback>
                                {employee.first_name[0]}
                                {employee.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {employee.first_name} {employee.last_name}
                                {employee.is_manager && (
                                  <Badge variant="secondary" className="text-xs">
                                    Manager
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                {employee.email && (
                                  <>
                                    <Mail className="h-3 w-3" />
                                    {employee.email}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{employee.job_title}</div>
                          {employee.department && (
                            <div className="text-sm text-muted-foreground">
                              {employee.department}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {employee.qualifications?.slice(0, 2).map((q) => (
                              <Badge key={q} variant="outline" className="text-xs">
                                {q}
                              </Badge>
                            ))}
                            {(employee.qualifications?.length || 0) > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(employee.qualifications?.length || 0) - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={employee.availability_status}
                            onValueChange={(value) =>
                              handleChangeStatus(employee, value as Employee['availability_status'])
                            }
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <div className="flex items-center gap-2">
                                <StatusIcon className="h-3 w-3" />
                                <span className="text-xs">{status.label}</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(AVAILABILITY_STATUS).map(([key, s]) => (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <s.icon className="h-3 w-3" />
                                    {s.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(employee)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(employee)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ProLayout>
  );
}
