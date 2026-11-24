import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts.ts';
import './styles/global.css';
import App from './App.tsx';
import { preventPageZoom } from './core/preventPageZoom.ts';

preventPageZoom();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
