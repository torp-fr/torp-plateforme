/**
 * TORP B2B - Gestion des Documents Entreprise
 *
 * TODO: Implémenter la page de gestion des documents de l'entreprise
 *
 * Fonctionnalités:
 * - Liste des documents uploadés (Kbis, assurances, certifications)
 * - Affichage du statut de chaque document (VALID, EXPIRING, EXPIRED, PENDING)
 * - Upload de nouveaux documents
 * - Téléchargement et suppression de documents
 * - Alertes pour les documents expirant bientôt
 * - Filtre par type de document
 *
 * Types de documents:
 * - KBIS
 * - Attestation URSSAF
 * - Attestation de vigilance
 * - Assurance décennale
 * - Assurance RC Pro
 * - Certifications (Qualibat, RGE, Qualifelec, Qualipac)
 *
 * @route /pro/documents
 */

export default function ProDocuments() {
  // TODO: Implémenter la gestion des documents

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Documents de l'entreprise</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Ajouter un document
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800">
          📄 <strong>Gestion des documents</strong>
        </p>
        <p className="text-sm text-yellow-700 mt-2">
          TODO: Liste des documents avec statut et actions
        </p>
      </div>

      {/* TODO: Ajouter la liste des documents */}
      {/* TODO: Ajouter le modal d'upload de document */}
      {/* TODO: Ajouter les alertes pour documents expirant */}
    </div>
  );
}
