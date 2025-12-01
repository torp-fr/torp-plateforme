/**
 * TORP B2B - Détail d'une Analyse de Devis
 *
 * TODO: Implémenter la page de détail d'une analyse de devis
 *
 * Fonctionnalités:
 * - Affichage du score TORP global et par axe (Transparence, Offre, Robustesse, Prix)
 * - Grade visuel (badge A+, A, B, C, D, F avec couleurs)
 * - Liste des recommandations d'amélioration (par ordre de priorité)
 * - Points bloquants identifiés (warnings critiques)
 * - Prévisualisation du devis uploadé
 * - Historique des versions (si ré-analyse)
 * - Actions : Générer ticket TORP, Re-analyser, Télécharger rapport PDF
 *
 * Sections:
 * 1. En-tête avec score et grade
 * 2. Graphique radar des 4 axes TORP
 * 3. Recommandations détaillées (avec impact estimé)
 * 4. Points bloquants (s'il y en a)
 * 5. Informations du devis (référence, montants, dates)
 * 6. Tracking du ticket (si généré)
 * 7. Historique des versions
 *
 * @route /pro/analyses/:id
 */

export default function ProAnalysisDetail() {
  // TODO: Implémenter la page de détail

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Analyse du devis</h1>
          <p className="text-gray-600">Référence: DEV-2024-001</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Générer ticket TORP
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Re-analyser
          </button>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-gray-800">
          🎯 <strong>Score TORP</strong>
        </p>
        <p className="text-sm text-gray-700 mt-2">
          TODO: Afficher le score global et le détail par axe
        </p>
      </div>

      {/* TODO: Ajouter la section score avec badge grade */}
      {/* TODO: Ajouter le graphique radar des 4 axes */}
      {/* TODO: Ajouter la liste des recommandations */}
      {/* TODO: Ajouter les points bloquants */}
      {/* TODO: Ajouter les infos du devis */}
      {/* TODO: Ajouter le tracking du ticket */}
      {/* TODO: Ajouter l'historique des versions */}
    </div>
  );
}
