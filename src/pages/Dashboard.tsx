/**
 * Dashboard - Version 2.0 - Nouveau système simplifié et optimisé
 * Interfaz principal pour la gestion de projets BTP avec IA
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  FolderOpen,
  FileSearch,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  BarChart3,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [stats] = useState({
    totalProjects: 0,
    analysesCompleted: 0,
    averageScore: 0,
    savingsIdentified: 0,
  });

  return (
    <div className="space-y-8 w-full">
      {/* Welcome Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">
            Bienvenue sur TORP 🏗️
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Plateforme intelligente de gestion de projets BTP
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Utilisateur: <span className="font-semibold">{user?.email}</span>
          </p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 text-base px-4 py-2">
          VERSION 2.0
        </Badge>
      </div>

      {/* Quick Actions - Main CTAs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Action 1: Analyze Quote */}
        <Card
          className="cursor-pointer hover:shadow-xl transition-all border-2 border-primary/20 bg-gradient-to-br from-blue-50 to-transparent"
          onClick={() => navigate('/quote-upload')}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileSearch className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Analyser un devis</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Upload & analyse IA instantanée
                </p>
                <div className="flex items-center gap-2 mt-3 text-primary font-semibold text-sm">
                  Commencer
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action 2: Dashboard Analytics */}
        <Card
          className="cursor-pointer hover:shadow-xl transition-all"
          onClick={() => navigate('/analytics')}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Voir les analyses</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Historique complet des audits
                </p>
                <div className="flex items-center gap-2 mt-3 text-purple-600 font-semibold text-sm">
                  Consulter
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action 3: Quick Actions */}
        <Card className="cursor-pointer hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Accès rapide</h3>
                <div className="space-y-2 mt-3">
                  <button
                    onClick={() => navigate('/projets')}
                    className="block text-sm text-green-600 hover:text-green-700 font-semibold"
                  >
                    → Mes projets
                  </button>
                  <button
                    onClick={() => navigate('/profile')}
                    className="block text-sm text-green-600 hover:text-green-700 font-semibold"
                  >
                    → Profil
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Projets créés</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalProjects}
                </p>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Analyses complétées</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.analysesCompleted}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Score moyen</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.averageScore ? `${stats.averageScore}/100` : 'N/A'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Économies détectées</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.savingsIdentified ? `${stats.savingsIdentified}€` : 'N/A'}
                </p>
              </div>
              <Sparkles className="h-8 w-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <Card className="border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Fonctionnalités principales
          </CardTitle>
          <CardDescription>
            Système complet de suivi et d'analyse des devis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span>Upload et analyse automatique des devis PDF</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span>Enrichissement des données entreprise via Pappers</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span>Dashboard analytics avec audit trail complet</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span>Scoring intelligent basé sur 5 axes d'évaluation</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span>Suivi serveur complet des requêtes API</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Getting Started Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Commencer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-blue-800">
            <strong>Étape 1:</strong> Uploaddez un devis PDF
          </p>
          <p className="text-sm text-blue-800">
            <strong>Étape 2:</strong> L'IA analyse automatiquement le document
          </p>
          <p className="text-sm text-blue-800">
            <strong>Étape 3:</strong> Consultez les résultats et recommandations
          </p>
          <Button
            className="w-full mt-4"
            onClick={() => navigate('/quote-upload')}
          >
            <FileSearch className="h-4 w-4 mr-2" />
            Uploader mon premier devis
          </Button>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="bg-gray-50">
        <CardContent className="p-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div className="text-sm">
            <p className="font-semibold text-gray-900">Système en ligne</p>
            <p className="text-gray-600">Tous les services sont opérationnels</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
