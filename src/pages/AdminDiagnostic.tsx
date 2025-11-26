/**
 * Admin Diagnostic Page
 * Test de connexion Supabase et vérification des données
 */

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function AdminDiagnostic() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    const diagnosticResults: DiagnosticResult[] = [];

    // 1. Test connexion Supabase
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      if (error) {
        diagnosticResults.push({
          name: '1. Connexion Supabase',
          status: 'error',
          message: `Erreur de connexion: ${error.message}`,
          details: error,
        });
      } else {
        diagnosticResults.push({
          name: '1. Connexion Supabase',
          status: 'success',
          message: 'Connexion réussie',
        });
      }
    } catch (err) {
      diagnosticResults.push({
        name: '1. Connexion Supabase',
        status: 'error',
        message: `Exception: ${err}`,
      });
    }

    // 2. Vérifier l'utilisateur courant
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        diagnosticResults.push({
          name: '2. Utilisateur connecté',
          status: 'error',
          message: 'Aucun utilisateur connecté',
        });
      } else {
        setCurrentUser(user);
        diagnosticResults.push({
          name: '2. Utilisateur connecté',
          status: 'success',
          message: `Email: ${user.email}`,
          details: user,
        });

        // Vérifier le profil dans la table users
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          diagnosticResults.push({
            name: '3. Profil utilisateur',
            status: 'error',
            message: `Erreur: ${profileError.message}`,
          });
        } else if (!userProfile) {
          diagnosticResults.push({
            name: '3. Profil utilisateur',
            status: 'error',
            message: 'Profil non trouvé dans la table users',
          });
        } else {
          const isAdmin = userProfile.user_type === 'admin';
          diagnosticResults.push({
            name: '3. Profil utilisateur',
            status: isAdmin ? 'success' : 'warning',
            message: `Type: ${userProfile.user_type} ${isAdmin ? '(ADMIN ✓)' : '(PAS ADMIN ✗)'}`,
            details: userProfile,
          });
        }
      }
    } catch (err) {
      diagnosticResults.push({
        name: '2-3. Utilisateur',
        status: 'error',
        message: `Exception: ${err}`,
      });
    }

    // 4. Test fonction RPC get_all_feedbacks
    try {
      const { data, error } = await supabase.rpc('get_all_feedbacks');
      if (error) {
        diagnosticResults.push({
          name: '4. RPC get_all_feedbacks',
          status: 'error',
          message: `Erreur: ${error.message}`,
          details: error,
        });
      } else {
        diagnosticResults.push({
          name: '4. RPC get_all_feedbacks',
          status: 'success',
          message: `Fonctionne ! ${data?.length || 0} feedbacks récupérés`,
          details: data,
        });
      }
    } catch (err) {
      diagnosticResults.push({
        name: '4. RPC get_all_feedbacks',
        status: 'error',
        message: `Exception: ${err}`,
      });
    }

    // 5. Test requête directe user_feedback
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .limit(10);

      if (error) {
        diagnosticResults.push({
          name: '5. Table user_feedback (direct)',
          status: 'error',
          message: `Erreur: ${error.message}`,
          details: error,
        });
      } else {
        diagnosticResults.push({
          name: '5. Table user_feedback (direct)',
          status: data.length > 0 ? 'success' : 'warning',
          message: `${data?.length || 0} feedbacks trouvés`,
          details: data,
        });
      }
    } catch (err) {
      diagnosticResults.push({
        name: '5. Table user_feedback',
        status: 'error',
        message: `Exception: ${err}`,
      });
    }

    // 6. Test RPC get_all_users
    try {
      const { data, error } = await supabase.rpc('get_all_users');
      if (error) {
        diagnosticResults.push({
          name: '6. RPC get_all_users',
          status: 'error',
          message: `Erreur: ${error.message}`,
        });
      } else {
        diagnosticResults.push({
          name: '6. RPC get_all_users',
          status: 'success',
          message: `${data?.length || 0} utilisateurs récupérés`,
          details: data,
        });
      }
    } catch (err) {
      diagnosticResults.push({
        name: '6. RPC get_all_users',
        status: 'error',
        message: `Exception: ${err}`,
      });
    }

    // 7. Test table analytics_events
    try {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('count');

      if (error) {
        diagnosticResults.push({
          name: '7. Table analytics_events',
          status: 'error',
          message: `Erreur: ${error.message}`,
        });
      } else {
        diagnosticResults.push({
          name: '7. Table analytics_events',
          status: 'success',
          message: 'Table accessible',
        });
      }
    } catch (err) {
      diagnosticResults.push({
        name: '7. Table analytics_events',
        status: 'error',
        message: `Exception: ${err}`,
      });
    }

    // 8. Vérifier la fonction is_admin
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        diagnosticResults.push({
          name: '8. Fonction is_admin()',
          status: 'error',
          message: `Erreur: ${error.message}`,
        });
      } else {
        diagnosticResults.push({
          name: '8. Fonction is_admin()',
          status: data ? 'success' : 'warning',
          message: `Résultat: ${data ? 'TRUE (vous êtes admin)' : 'FALSE (vous n\'êtes PAS admin)'}`,
          details: data,
        });
      }
    } catch (err) {
      diagnosticResults.push({
        name: '8. Fonction is_admin()',
        status: 'error',
        message: `Fonction n'existe pas (migration 004 non appliquée)`,
      });
    }

    setResults(diagnosticResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">🔧 Diagnostic Admin</h1>
          <p className="text-muted-foreground">
            Test de connexion Supabase et vérification des permissions
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Lancer le diagnostic</CardTitle>
            <CardDescription>
              Ce test vérifie la connexion Supabase, vos permissions et l'accès aux données
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runDiagnostic} disabled={isRunning} size="lg">
              {isRunning ? 'Diagnostic en cours...' : 'Lancer le diagnostic'}
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Résultats du diagnostic</CardTitle>
              <CardDescription>
                {results.filter((r) => r.status === 'success').length} succès •{' '}
                {results.filter((r) => r.status === 'warning').length} avertissements •{' '}
                {results.filter((r) => r.status === 'error').length} erreurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : result.status === 'error'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="font-medium mb-1">{result.name}</div>
                        <div className="text-sm text-muted-foreground">{result.message}</div>
                        {result.details && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-primary">
                              Voir les détails
                            </summary>
                            <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommandations */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium mb-2">💡 Recommandations</h3>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  {results.some((r) => r.name.includes('is_admin') && r.status === 'error') && (
                    <li>
                      ❌ <strong>Migration 004 non appliquée</strong> : Exécutez{' '}
                      <code className="bg-white px-1 rounded">supabase db push</code>
                    </li>
                  )}
                  {results.some(
                    (r) => r.name.includes('is_admin') && r.message.includes('FALSE')
                  ) && (
                    <li>
                      ⚠️ <strong>Vous n'êtes pas admin</strong> : Modifiez votre user_type dans
                      Supabase (table users) en 'admin'
                    </li>
                  )}
                  {results.some((r) => r.name.includes('Connexion') && r.status === 'error') && (
                    <li>
                      ❌ <strong>Connexion Supabase échouée</strong> : Vérifiez vos variables
                      d'environnement
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {currentUser && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Informations utilisateur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Email :</span> {currentUser.email}
                </div>
                <div>
                  <span className="font-medium">User ID :</span>{' '}
                  <code className="bg-muted px-1 rounded text-xs">{currentUser.id}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
