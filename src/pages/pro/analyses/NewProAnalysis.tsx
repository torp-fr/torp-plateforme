/**
 * TORP B2B - Nouvelle Analyse de Devis
 *
 * TODO: Implémenter le formulaire de création d'une nouvelle analyse
 *
 * Fonctionnalités:
 * - Upload du fichier devis (PDF, image)
 * - Saisie des informations du devis (référence, nom projet, montants)
 * - Lancement de l'analyse IA
 * - Affichage de l'état d'avancement (extraction OCR, analyse, scoring)
 * - Redirection vers la page de détail une fois terminé
 *
 * Validations:
 * - Fichier obligatoire (max 10 MB)
 * - Formats acceptés: PDF, JPG, PNG
 * - Référence devis obligatoire
 *
 * @route /pro/analyses/new
 */

export default function NewProAnalysis() {
  // TODO: Implémenter le formulaire de nouvelle analyse

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Nouvelle analyse de devis</h1>
      <p className="text-gray-600 mb-8">
        Uploadez votre devis pour obtenir une analyse TORP et des recommandations d'amélioration
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800">
          🚀 <strong>Comment ça marche ?</strong>
        </p>
        <ol className="list-decimal list-inside text-sm text-blue-700 mt-2">
          <li>Uploadez votre devis (PDF ou image)</li>
          <li>Renseignez les informations principales</li>
          <li>L'IA TORP analyse votre devis</li>
          <li>Vous recevez un score et des recommandations</li>
          <li>Générez un ticket TORP à joindre à votre devis</li>
        </ol>
      </div>

      {/* TODO: Ajouter le formulaire d'upload */}
      {/* TODO: Ajouter la zone de drag & drop */}
      {/* TODO: Ajouter les champs de saisie (référence, projet, montants) */}
      {/* TODO: Ajouter le bouton de lancement de l'analyse */}
      {/* TODO: Ajouter l'indicateur de progression */}
    </div>
  );
}
