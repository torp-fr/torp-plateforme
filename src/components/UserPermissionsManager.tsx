import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Crown, 
  Eye, 
  Settings, 
  UserCheck, 
  Users, 
  Plus, 
  MapPin, 
  Calendar, 
  Edit, 
  Trash2, 
  Lock, 
  Shield, 
  Unlock, 
  Building, 
  Download 
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super-admin' | 'analyste' | 'gestionnaire-budget' | 'invite';
  territory: string;
  lastLogin: string;
  status: 'active' | 'inactive' | 'pending';
  permissions: {
    viewDashboard: boolean;
    viewDetails: boolean;
    exportData: boolean;
    manageBudget: boolean;
    manageUsers: boolean;
    apiAccess: boolean;
  };
}

const UserPermissionsManager = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const mockUsers: User[] = [
    {
      id: '1',
      name: 'Marie Dubois',
      email: 'marie.dubois@departement44.fr',
      role: 'super-admin',
      territory: 'Loire-Atlantique',
      lastLogin: '2024-03-20 14:30',
      status: 'active',
      permissions: {
        viewDashboard: true,
        viewDetails: true,
        exportData: true,
        manageBudget: true,
        manageUsers: true,
        apiAccess: true
      }
    },
    {
      id: '2',
      name: 'Pierre Martin',
      email: 'p.martin@nantesmetropole.fr',
      role: 'analyste',
      territory: 'Nantes Métropole',
      lastLogin: '2024-03-22 09:15',
      status: 'active',
      permissions: {
        viewDashboard: true,
        viewDetails: true,
        exportData: true,
        manageBudget: false,
        manageUsers: false,
        apiAccess: false
      }
    },
    {
      id: '3',
      name: 'Sophie Bernard',
      email: 'sophie.bernard@ville-nantes.fr',
      role: 'gestionnaire-budget',
      territory: 'Nantes',
      lastLogin: '2024-03-19 16:45',
      status: 'active',
      permissions: {
        viewDashboard: true,
        viewDetails: false,
        exportData: false,
        manageBudget: true,
        manageUsers: false,
        apiAccess: false
      }
    },
    {
      id: '4',
      name: 'Jean Moreau',
      email: 'j.moreau@consultant.com',
      role: 'invite',
      territory: 'Loire-Atlantique',
      lastLogin: '2024-03-18 11:20',
      status: 'active',
      permissions: {
        viewDashboard: true,
        viewDetails: false,
        exportData: false,
        manageBudget: false,
        manageUsers: false,
        apiAccess: false
      }
    }
  ];

  const [users, setUsers] = useState<User[]>(mockUsers);

  const getRoleIcon = (role: string) => {
    const icons = {
      'super-admin': Crown,
      'analyste': Eye,
      'gestionnaire-budget': Settings,
      'invite': UserCheck
    };
    return icons[role as keyof typeof icons] || Users;
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" | "destructive" => {
    const variants = {
      'super-admin': 'default' as const,
      'analyste': 'secondary' as const,
      'gestionnaire-budget': 'outline' as const,
      'invite': 'destructive' as const
    };
    return variants[role as keyof typeof variants] || 'outline';
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" => {
    const variants = {
      'active': 'default' as const,
      'inactive': 'secondary' as const,
      'pending': 'outline' as const
    };
    return variants[status as keyof typeof variants] || 'outline';
  };

  const updateUserPermission = (userId: string, permission: keyof User['permissions'], value: boolean) => {
    setUsers(prev => prev.map(user => 
      user.id === userId 
        ? { ...user, permissions: { ...user.permissions, [permission]: value } }
        : user
    ));
  };

  const rolePermissionsPresets = {
    'super-admin': {
      viewDashboard: true,
      viewDetails: true,
      exportData: true,
      manageBudget: true,
      manageUsers: true,
      apiAccess: true
    },
    'analyste': {
      viewDashboard: true,
      viewDetails: true,
      exportData: true,
      manageBudget: false,
      manageUsers: false,
      apiAccess: false
    },
    'gestionnaire-budget': {
      viewDashboard: true,
      viewDetails: false,
      exportData: false,
      manageBudget: true,
      manageUsers: false,
      apiAccess: false
    },
    'invite': {
      viewDashboard: true,
      viewDetails: false,
      exportData: false,
      manageBudget: false,
      manageUsers: false,
      apiAccess: false
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gestion Utilisateurs & Permissions Territoriales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Gestion des accès selon hiérarchie territoriale et conformité RGPD
            </div>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nouvel utilisateur
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="hierarchy">Hiérarchie</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liste des utilisateurs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Utilisateurs Actifs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map((user) => {
                    const RoleIcon = getRoleIcon(user.role);
                    return (
                      <div 
                        key={user.id} 
                        className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedUser?.id === user.id ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <RoleIcon className="w-5 h-5 text-primary" />
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role}
                            </Badge>
                            <Badge variant={getStatusBadgeVariant(user.status)}>
                              {user.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {user.territory}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {user.lastLogin}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Détail utilisateur sélectionné */}
            {selectedUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Détail Utilisateur</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? <Lock className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Informations de base */}
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label htmlFor="name">Nom complet</Label>
                        <Input 
                          id="name" 
                          value={selectedUser.name} 
                          disabled={!isEditing}
                          className={!isEditing ? 'bg-muted' : ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input 
                          id="email" 
                          type="email"
                          value={selectedUser.email} 
                          disabled={!isEditing}
                          className={!isEditing ? 'bg-muted' : ''}
                        />
                      </div>
                      <div>
                        <Label htmlFor="territory">Territoire</Label>
                        <Select value={selectedUser.territory} disabled={!isEditing}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner territoire" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Loire-Atlantique">Loire-Atlantique</SelectItem>
                            <SelectItem value="Nantes Métropole">Nantes Métropole</SelectItem>
                            <SelectItem value="Nantes">Nantes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="role">Rôle</Label>
                        <Select value={selectedUser.role} disabled={!isEditing}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner rôle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super-admin">Super Admin</SelectItem>
                            <SelectItem value="analyste">Analyste</SelectItem>
                            <SelectItem value="gestionnaire-budget">Gestionnaire Budget</SelectItem>
                            <SelectItem value="invite">Invité</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Permissions détaillées */}
                    <div className="space-y-3">
                      <h4 className="font-medium">Permissions</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedUser.permissions).map(([permission, enabled]) => (
                          <div key={permission} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm capitalize">
                                {permission.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                            </div>
                            <Switch
                              checked={enabled}
                              disabled={!isEditing}
                              onCheckedChange={(value) => 
                                updateUserPermission(selectedUser.id, permission as keyof User['permissions'], value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    {isEditing && (
                      <div className="flex gap-2 pt-4 border-t">
                        <Button size="sm" className="flex-1">
                          Sauvegarder
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setIsEditing(false)}
                        >
                          Annuler
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Matrice des Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Presets par rôle */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {Object.entries(rolePermissionsPresets).map(([role, permissions]) => {
                    const RoleIcon = getRoleIcon(role);
                    return (
                      <Card key={role} className="border-border">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <RoleIcon className="w-4 h-4" />
                            {role.replace('-', ' ')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            {Object.entries(permissions).map(([permission, enabled]) => (
                              <div key={permission} className="flex items-center justify-between text-xs">
                                <span className="capitalize">
                                  {permission.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                                {enabled ? (
                                  <Unlock className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Lock className="w-3 h-3 text-red-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Tableau détaillé */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border p-3 text-left">Permission</th>
                        <th className="border border-border p-3 text-center">Super Admin</th>
                        <th className="border border-border p-3 text-center">Analyste</th>
                        <th className="border border-border p-3 text-center">Gest. Budget</th>
                        <th className="border border-border p-3 text-center">Invité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(rolePermissionsPresets['super-admin']).map((permission) => (
                        <tr key={permission}>
                          <td className="border border-border p-3 font-medium">
                            {permission.replace(/([A-Z])/g, ' $1').trim()}
                          </td>
                          {Object.keys(rolePermissionsPresets).map((role) => (
                            <td key={role} className="border border-border p-3 text-center">
                              {rolePermissionsPresets[role as keyof typeof rolePermissionsPresets][permission as keyof typeof rolePermissionsPresets['super-admin']] ? (
                                <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                              ) : (
                                <div className="w-4 h-4 mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hiérarchie Territoriale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Les utilisateurs héritent automatiquement des permissions selon la hiérarchie : 
                    Région {'>'}  Département {'>'}  Métropole {'>'}  Commune
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="border-l-4 border-primary pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-5 h-5 text-primary" />
                      <span className="font-medium">Région Loire-Atlantique</span>
                      <Badge>Niveau 1</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      Accès complet à tous les départements et communes de la région
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>• Vision 360° territoire régional</div>
                      <div>• Export toutes données anonymisées</div>
                      <div>• Gestion utilisateurs départements</div>
                      <div>• API complète inter-territoires</div>
                    </div>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4 ml-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Nantes Métropole</span>
                      <Badge variant="secondary">Niveau 2</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      Accès aux 24 communes métropolitaines
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>• Dashboard métropolitain</div>
                      <div>• Gestion participation intercommunale</div>
                      <div>• Benchmarks communes membres</div>
                      <div>• Refacturation possible</div>
                    </div>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4 ml-8">
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Ville de Nantes</span>
                      <Badge variant="outline">Niveau 3</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      Données communales uniquement
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>• Analytics territoire communal</div>
                      <div>• Gestion budget propre</div>
                      <div>• Exports citoyens commune</div>
                      <div>• Alertes secteurs/quartiers</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-2">Règles de Couverture Anti-Doublon</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>• Si la région adhère : communes accès gratuit automatique</p>
                    <p>• Si région non-adhérente : département peut couvrir ses communes</p>
                    <p>• Un seul payeur par territoire selon hiérarchie administrative</p>
                    <p>• Pas de double facturation possible</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit & Conformité RGPD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        Logs d'Accès
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Dernières 24h :</span>
                          <span className="font-medium">247 accès</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tentatives échec :</span>
                          <span className="font-medium">3</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Exports données :</span>
                          <span className="font-medium">12</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Anonymisation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Données masquées :</span>
                          <span className="font-medium">100%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Conformité RGPD :</span>
                          <span className="font-medium text-green-600">✓ Active</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Opt-out citoyens :</span>
                          <span className="font-medium">2.3%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="w-4 h-4 text-orange-500" />
                        Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>2FA activée :</span>
                          <span className="font-medium">4/4 users</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Chiffrement :</span>
                          <span className="font-medium text-green-600">AES-256</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Retention :</span>
                          <span className="font-medium">10 ans</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Journal d'Audit Récent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { time: '14:30', user: 'marie.dubois@departement44.fr', action: 'Export rapport mensuel', level: 'info' },
                        { time: '11:15', user: 'p.martin@nantesmetropole.fr', action: 'Consultation dashboard analytics', level: 'info' },
                        { time: '09:45', user: 'system', action: 'Anonymisation automatique données', level: 'info' },
                        { time: '08:30', user: 'failed_login', action: 'Tentative connexion échouée', level: 'warning' }
                      ].map((log, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              log.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div>
                              <div className="text-sm font-medium">{log.action}</div>
                              <div className="text-xs text-muted-foreground">{log.user}</div>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">{log.time}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export logs complets
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Conservation logs : 3 ans selon réglementation
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserPermissionsManager;