import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Diagnostic logging for production debugging
console.log('[TORP] Starting application...');
console.log('[TORP] Environment:', import.meta.env.MODE);

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error('Root element not found! Expected <div id="root"></div> in index.html');
  }

  console.log('[TORP] Root element found, creating React root...');

  const root = createRoot(rootElement);

  console.log('[TORP] Rendering App component...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  console.log('[TORP] App rendered successfully');
} catch (error) {
  console.error('[TORP] Failed to initialize:', error);
  // Display error in the DOM as fallback
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f0f0f0; font-family: system-ui;">
        <div style="padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h1 style="color: #d32f2f; margin: 0 0 10px 0;">Erreur de chargement</h1>
          <p style="color: #666; margin: 0;">Impossible de démarrer l'application. Consultez la console pour plus de détails.</p>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; color: #d32f2f; font-size: 12px;">
${String(error)}
          </pre>
        </div>
      </div>
    `;
  }
}
