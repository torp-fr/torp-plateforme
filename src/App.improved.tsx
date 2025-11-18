/**
 * App Component - Improved Version with Lazy Loading
 * This is the new improved version with code splitting and error boundaries
 * To use: rename App.tsx to App.old.tsx and rename this file to App.tsx
 */

import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { env, logEnvInfo } from "@/config/env";

// Loading component
import { Loader2 } from "lucide-react";

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
      <p className="text-muted-foreground">Chargement...</p>
    </div>
  </div>
);

// Lazy load pages for better performance
// Core pages (loaded immediately)
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Feature pages (lazy loaded)
const Analyze = lazy(() => import("./pages/Analyze"));
const Results = lazy(() => import("./pages/Results"));
const ResultsInteractive = lazy(() => import("./pages/ResultsInteractive"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const Projects = lazy(() => import("./pages/Projects"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Demo = lazy(() => import("./pages/Demo"));
const ProjectTracking = lazy(() => import("./pages/ProjectTracking"));
const FinancingPlatform = lazy(() => import("./pages/FinancingPlatform"));
const FormulaPicker = lazy(() => import("./pages/FormulaPicker"));
const AnalyzingPage = lazy(() => import("./pages/AnalyzingPage"));

// Dashboard pages (lazy loaded)
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CollectivitesDashboard = lazy(() => import("./pages/CollectivitesDashboard"));
const ProjectDashboard = lazy(() => import("./pages/ProjectDashboard"));
const PrescripteursDashboard = lazy(() => import("./pages/PrescripteursDashboard"));
const ImprovedB2BDashboard = lazy(() => import("@/pages/ImprovedB2BDashboard"));
const B2CDashboard = lazy(() => import("./pages/B2CDashboard"));
const B2B2CDashboard = lazy(() => import("./pages/B2B2CDashboard"));

// Other pages (lazy loaded)
const Marketplace = lazy(() => import("./pages/Marketplace"));
const DiscoveryFlow = lazy(() => import("./pages/DiscoveryFlow"));
const TorpCompleteFlow = lazy(() => import("./pages/TorpCompleteFlow"));
const AlgorithmicSegments = lazy(() => import("./pages/AlgorithmicSegments"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Log environment info in development
if (env.app.debugMode) {
  logEnvInfo();
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/demo" element={<Demo />} />

                {/* Discovery flows */}
                <Route path="/discovery" element={<DiscoveryFlow />} />
                <Route path="/torp-complete" element={<TorpCompleteFlow />} />

                {/* Protected routes - Analysis */}
                <Route
                  path="/analyze"
                  element={
                    <ProtectedRoute>
                      <Analyze />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analyzing"
                  element={
                    <ProtectedRoute>
                      <AnalyzingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/results"
                  element={
                    <ProtectedRoute>
                      <Results />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/results-interactive"
                  element={
                    <ProtectedRoute>
                      <ResultsInteractive />
                    </ProtectedRoute>
                  }
                />

                {/* Protected routes - Dashboards */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/b2c-dashboard"
                  element={
                    <ProtectedRoute requiredTypes={['B2C']}>
                      <B2CDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/improved-b2b-dashboard"
                  element={
                    <ProtectedRoute requiredTypes={['B2B']}>
                      <ImprovedB2BDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/collectivites-dashboard"
                  element={
                    <ProtectedRoute requiredTypes={['B2G']}>
                      <CollectivitesDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/prescripteurs-dashboard"
                  element={
                    <ProtectedRoute requiredTypes={['B2B2C']}>
                      <B2B2CDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin-dashboard"
                  element={
                    <ProtectedRoute requiredTypes={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Protected routes - Projects */}
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <Projects />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/project-dashboard"
                  element={
                    <ProtectedRoute>
                      <ProjectDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/project-tracking"
                  element={
                    <ProtectedRoute>
                      <ProjectTracking />
                    </ProtectedRoute>
                  }
                />

                {/* Protected routes - Features */}
                <Route
                  path="/financing"
                  element={
                    <ProtectedRoute>
                      <FinancingPlatform />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/formula-picker"
                  element={
                    <ProtectedRoute>
                      <FormulaPicker />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/marketplace"
                  element={
                    <ProtectedRoute>
                      <Marketplace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/segments"
                  element={
                    <ProtectedRoute>
                      <AlgorithmicSegments />
                    </ProtectedRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
