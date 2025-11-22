#!/bin/bash
# Script de déploiement des Edge Functions Supabase
#
# Prérequis:
# 1. Supabase CLI installé: https://supabase.com/docs/guides/cli
# 2. Authentifié: supabase login
# 3. Projet lié: supabase link --project-ref YOUR_PROJECT_REF

echo "🚀 Déploiement des Edge Functions corrigées..."
echo ""

# Déployer la fonction standalone (la plus utilisée)
echo "📦 Déploiement de ingest-document-standalone..."
supabase functions deploy ingest-document-standalone

if [ $? -eq 0 ]; then
  echo "✅ ingest-document-standalone déployée avec succès"
else
  echo "❌ Erreur lors du déploiement de ingest-document-standalone"
  exit 1
fi

echo ""

# Déployer la fonction principale
echo "📦 Déploiement de ingest-document..."
supabase functions deploy ingest-document

if [ $? -eq 0 ]; then
  echo "✅ ingest-document déployée avec succès"
else
  echo "❌ Erreur lors du déploiement de ingest-document"
  exit 1
fi

echo ""
echo "🎉 Toutes les fonctions ont été déployées avec succès!"
echo ""
echo "Les erreurs 'Maximum call stack size exceeded' devraient maintenant être résolues."
