/**
 * Admin Users Management Page
 * Manage user roles and permissions
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService, type AdminUser } from '@/services/api/supabase/admin.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Shield,
  ShieldOff,
  Loader,
  Check,
  X,
  Edit2,
} from 'lucide-react';

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      if (users.length === 0) setLoading(true);
      const allUsers = await adminService.getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }

  async function handlePromoteToAdmin(userId: string) {
    try {
      setUpdating(userId);
      const success = await adminService.promoteToAdmin(userId);
      if (success) {
        await loadUsers();
      } else {
        setError('Erreur lors de la promotion de l\'utilisateur');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Erreur lors de la promotion');
    } finally {
      setUpdating(null);
    }
  }

  async function handleDemoteToUser(userId: string) {
    try {
      setUpdating(userId);
      const success = await adminService.demoteToUser(userId);
      if (success) {
        await loadUsers();
      } else {
        setError('Erreur lors de la rétrogradation de l\'utilisateur');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Erreur lors de la rétrogradation');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Gestion des Utilisateurs</h1>
        <p className="text-muted-foreground mt-1">Gérez les rôles et permissions des utilisateurs</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Utilisateurs</p>
                <p className="text-4xl font-bold text-foreground mt-2">{users.length}</p>
              </div>
              <Users className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Administrateurs</p>
                <p className="text-4xl font-bold text-foreground mt-2">
                  {users.filter(u => u.is_admin).length}
                </p>
              </div>
              <Shield className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">KB Upload Autorisé</p>
                <p className="text-4xl font-bold text-foreground mt-2">
                  {users.filter(u => u.can_upload_kb).length}
                </p>
              </div>
              <Edit2 className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tous les Utilisateurs</CardTitle>
              <CardDescription>Cliquez sur un utilisateur pour modifier son rôle</CardDescription>
            </div>
            {loading && users.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader className="h-4 w-4 animate-spin" />
                <span>Actualisation...</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!users.length && loading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 font-semibold">Nom</th>
                    <th className="text-left py-3 px-4 font-semibold">Rôle</th>
                    <th className="text-left py-3 px-4 font-semibold">KB Upload</th>
                    <th className="text-left py-3 px-4 font-semibold">Créé</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-6 w-20" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-8" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-8 w-24" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 font-semibold">Nom</th>
                    <th className="text-left py-3 px-4 font-semibold">Rôle</th>
                    <th className="text-left py-3 px-4 font-semibold">KB Upload</th>
                    <th className="text-left py-3 px-4 font-semibold">Créé</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{user.email}</td>
                      <td className="py-3 px-4">{user.full_name || '-'}</td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            user.is_admin
                              ? 'bg-blue-600 hover:bg-blue-700'
                              : 'bg-gray-400 hover:bg-gray-500'
                          }
                        >
                          {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {user.can_upload_kb ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <X className="h-5 w-5 text-gray-400" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4">
                        {user.role !== 'super_admin' && (
                          <div className="flex gap-2">
                            {user.is_admin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDemoteToUser(user.id)}
                                disabled={updating === user.id}
                                className="text-xs"
                              >
                                {updating === user.id ? (
                                  <Loader className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ShieldOff className="h-3 w-3 mr-1" />
                                )}
                                Rétrograder
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePromoteToAdmin(user.id)}
                                disabled={updating === user.id}
                                className="text-xs"
                              >
                                {updating === user.id ? (
                                  <Loader className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Shield className="h-3 w-3 mr-1" />
                                )}
                                Promouvoir
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
