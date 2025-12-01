/**
 * TORP - Page Publique de Consultation de Ticket
 *
 * TODO: Implémenter la page publique accessible via QR code
 *
 * Fonctionnalités:
 * - Récupération des données d'analyse via le ticket_code dans l'URL
 * - Affichage du score TORP et grade
 * - Affichage des informations du devis (sans données sensibles)
 * - Affichage des garanties et certifications de l'entreprise
 * - Enregistrement de l'événement de consultation (tracking)
 * - Design public optimisé (pas de connexion requise)
 *
 * URL: /t/:code
 * Exemple: https://torp.app/t/TORP-ABC123XY
 *
 * Cette page est accessible sans authentification.
 * Les données affichées sont limitées (pas d'infos sensibles).
 *
 * @route /t/:code
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function TicketPublicView() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    // TODO: Appeler l'API pour récupérer les données du ticket
    // TODO: Enregistrer l'événement de consultation

    // Simulation
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'analyse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Ticket introuvable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header TORP */}
      <div className="bg-blue-600 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">TORP</h1>
              <p className="text-blue-100 text-sm">Certification de Devis</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">A-</div>
              <div className="text-sm text-blue-100">Score: 8.7/10</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📊 Analyse du devis</h2>
          <p className="text-gray-600">
            TODO: Afficher les détails de l'analyse (score par axe, entreprise, etc.)
          </p>
        </div>

        {/* TODO: Ajouter les sections */}
        {/* - Score TORP détaillé par axe */}
        {/* - Informations entreprise (raison sociale, SIRET, certifications) */}
        {/* - Garanties et assurances */}
        {/* - Badge de confiance */}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-8">
          <p>
            Ce devis a été analysé et certifié par{' '}
            <a href="https://torp.app" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              TORP.app
            </a>
          </p>
          <p className="mt-2">Code: {code}</p>
        </div>
      </div>
    </div>
  );
}
