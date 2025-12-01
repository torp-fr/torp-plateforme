/**
 * TORP B2B - Liste des Analyses de Devis
 *
 * TODO: Implémenter la liste des analyses de devis du professionnel
 *
 * Fonctionnalités:
 * - Liste paginée des analyses (avec filtres et tri)
 * - Affichage du score TORP et grade pour chaque analyse
 * - Statut de l'analyse (PENDING, PROCESSING, COMPLETED, FAILED)
 * - Indicateur si le ticket TORP a été généré
 * - Nombre de consultations du ticket
 * - Actions : Voir détails, Re-analyser, Générer ticket, Supprimer
 *
 * Filtres:
 * - Par statut
 * - Par grade (A+, A, B, C, D, F)
 * - Par date
 * - Par référence devis
 *
 * Tri:
 * - Date (plus récent/ancien)
 * - Score (meilleur/moins bon)
 * - Nom projet (A-Z)
 *
 * @route /pro/analyses
 */

export default function ProAnalysesList() {
  // TODO: Implémenter la liste des analyses

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mes analyses de devis</h1>
        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          + Nouvelle analyse
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-gray-800">
          📊 <strong>Liste des analyses</strong>
        </p>
        <p className="text-sm text-gray-700 mt-2">
          TODO: Afficher la liste des analyses avec filtres et tri
        </p>
      </div>

      {/* TODO: Ajouter les filtres */}
      {/* TODO: Ajouter la table/liste des analyses */}
      {/* TODO: Ajouter la pagination */}
    </div>
  );
}
