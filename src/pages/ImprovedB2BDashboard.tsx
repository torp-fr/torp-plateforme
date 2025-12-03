/**
 * ImprovedB2BDashboard - DEPRECATED
 * Redirige vers /pro pour le nouveau module B2B sans données mockées
 */
import { Navigate } from "react-router-dom";

export default function ImprovedB2BDashboard() {
  // Redirection vers le nouveau dashboard Pro
  return <Navigate to="/pro" replace />;
}
