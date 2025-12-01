/**
 * TORP B2B - Paramètres Entreprise
 *
 * TODO: Implémenter la page de paramètres de l'entreprise
 *
 * Sections:
 * 1. Informations entreprise (modification des données SIRET, adresse, contact)
 * 2. Documents (raccourci vers la gestion des documents)
 * 3. Préférences de notification (emails, alertes documents expirés)
 * 4. Intégrations (API, webhooks pour future intégration CRM)
 * 5. Facturation et abonnement (pour future version payante)
 * 6. Suppression du compte
 *
 * Fonctionnalités:
 * - Formulaire de modification des infos entreprise
 * - Gestion des préférences de notification
 * - Affichage de l'API key (pour future API REST)
 * - Gestion de l'abonnement (si mode payant activé)
 *
 * @route /pro/settings
 */

export default function ProSettings() {
  // TODO: Implémenter les paramètres entreprise

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Paramètres de l'entreprise</h1>

      <div className="space-y-6">
        {/* Section 1: Informations entreprise */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Informations entreprise</h2>
          <p className="text-gray-600 text-sm mb-4">
            TODO: Formulaire de modification des informations entreprise
          </p>
          {/* TODO: Ajouter le formulaire */}
        </div>

        {/* Section 2: Documents */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Documents</h2>
          <p className="text-gray-600 text-sm mb-4">
            Gérez vos documents officiels (Kbis, assurances, certifications)
          </p>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Gérer les documents →
          </button>
        </div>

        {/* Section 3: Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <p className="text-gray-600 text-sm mb-4">
            TODO: Options de notification (email, alertes documents)
          </p>
          {/* TODO: Ajouter les toggles de notification */}
        </div>

        {/* Section 4: Zone dangereuse */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-4">Zone dangereuse</h2>
          <p className="text-red-600 text-sm mb-4">
            La suppression de votre compte est irréversible
          </p>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Supprimer mon compte
          </button>
        </div>
      </div>
    </div>
  );
}
