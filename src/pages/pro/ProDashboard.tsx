/**
 * TORP B2B - Dashboard Principal Professionnel
 *
 * TODO: Implémenter le dashboard principal pour les professionnels B2B
 *
 * Fonctionnalités:
 * - Afficher les statistiques de l'entreprise (nombre de devis analysés, score moyen)
 * - Liste des dernières analyses de devis
 * - Graphiques de performance (évolution du score TORP)
 * - Accès rapide aux actions principales (nouvelle analyse, documents, paramètres)
 * - Notifications importantes (documents expirés, etc.)
 *
 * @route /pro/dashboard
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function ProDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Vérifier que l'utilisateur est bien de type B2B
    if (user && user.user_type !== 'B2B') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard Professionnel</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800">
          🚧 <strong>Module B2B en construction</strong>
        </p>
        <p className="text-sm text-yellow-700 mt-2">
          Cette page sera bientôt disponible. Fonctionnalités à venir :
        </p>
        <ul className="list-disc list-inside text-sm text-yellow-700 mt-2">
          <li>Tableau de bord avec statistiques</li>
          <li>Liste des analyses de devis</li>
          <li>Gestion des documents entreprise</li>
          <li>Génération de tickets TORP</li>
        </ul>
      </div>

      {/* TODO: Ajouter les sections du dashboard */}
      {/* - Card avec statistiques principales */}
      {/* - Graphique d'évolution du score TORP */}
      {/* - Liste des dernières analyses */}
      {/* - Actions rapides */}
    </div>
  );
}
