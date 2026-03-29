import React from 'react';
import { createRoot } from 'react-dom/client';
import { initPdfJs } from './lib/pdf';
import App from './App.tsx';
import './index.css';

// Initialize PDF.js BEFORE rendering (must be done once at startup)
try {
  initPdfJs();
} catch (error) {
  console.error('Failed to initialize PDF.js, continuing anyway:', error);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
