/**
 * TORP B2B - Onboarding Professionnel
 *
 * TODO: Implémenter le wizard d'onboarding pour la création du profil entreprise
 *
 * Étapes:
 * 1. Saisie du SIRET
 * 2. Vérification automatique des données SIREN/SIRET (API Pappers/INSEE)
 * 3. Confirmation des informations entreprise
 * 4. Upload des documents obligatoires (Kbis, assurances)
 * 5. Validation et création du profil
 *
 * Composants nécessaires:
 * - Stepper (étapes 1-5)
 * - Formulaire de saisie SIRET avec validation
 * - Affichage des données récupérées de l'API
 * - Zone de drag & drop pour upload de documents
 * - Récapitulatif avant validation
 *
 * @route /pro/onboarding
 */

export default function ProOnboarding() {
  // TODO: Implémenter le wizard multi-étapes

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Création de votre profil entreprise</h1>
      <p className="text-gray-600 mb-8">
        Complétez les étapes suivantes pour créer votre profil professionnel TORP
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800">
          ℹ️ <strong>Étape 1/5 : Saisie du SIRET</strong>
        </p>
        <p className="text-sm text-blue-700 mt-2">
          TODO: Formulaire de saisie et vérification SIRET
        </p>
      </div>

      {/* TODO: Ajouter le stepper et les différentes étapes */}
    </div>
  );
}
