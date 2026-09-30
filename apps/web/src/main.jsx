
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/dashboardEffects.css';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';

const isBrowserExtensionNoise = (value) => {
  const msg = String(value?.message || value || '').toLowerCase();
  return (
    msg.includes('listener indicated an asynchronous response') ||
    msg.includes('message channel closed') ||
    msg.includes('extension context invalidated') ||
    msg.includes('the message port closed')
  );
};

// Suprime erros de extensões de navegador que usam chrome.runtime.onMessage
// com resposta assíncrona (return true) mas perdem o canal quando a página
// navega. Esses erros não afetam a funcionalidade da aplicação.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message || event.reason || '');
  const normalizedMsg = msg.toLowerCase();
  if (
    normalizedMsg.includes('failed to fetch dynamically imported module') ||
    normalizedMsg.includes('importing a module script failed') ||
    normalizedMsg.includes('error loading dynamically imported module')
  ) {
    event.preventDefault();
    const alreadyReloaded = sessionStorage.getItem('crm-chunk-reload');
    if (!alreadyReloaded) {
      sessionStorage.setItem('crm-chunk-reload', '1');
      window.location.reload();
    }
    return;
  }

  if (isBrowserExtensionNoise(event.reason)) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (isBrowserExtensionNoise(event.error || event.message)) {
    event.preventDefault();
  }
});

window.addEventListener('load', () => {
  sessionStorage.removeItem('crm-chunk-reload');
}, { once: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
