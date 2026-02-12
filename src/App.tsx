import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

// Layouts
import MainLayout from "./components/layout/MainLayout";

// Pages - Core MVP
import LandingPage from "./pages/LandingPage";
import QuotePage from "./pages/QuotePage";
import QuoteSuccessPage from "./pages/QuoteSuccessPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Auth
import { ProtectedRoute } from "@/components/auth/ProRoute";

// Protected Pages
import DashboardUnifie from "./pages/DashboardUnifie";
import ProjetPage from "./pages/projet/ProjetPage";
import ProjetsListePage from "./pages/projet/ProjetsListePage";
import Profile from "./pages/Profile";
import Analyze from "./pages/Analyze";
import Results from "./pages/Results";

const queryClient = new QueryClient();

const AppContent = () => {
  const { userType } = useApp();

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/quote" element={<QuotePage />} />
          <Route path="/quote-success" element={<QuoteSuccessPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes with Layout */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardUnifie />} />
            <Route path="/projets" element={<ProjetsListePage />} />
            <Route path="/projet/:projectId" element={<ProjetPage />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/results" element={<Results />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <AppProvider>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </AppProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
