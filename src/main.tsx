import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './ui/theme/tokens.css';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
