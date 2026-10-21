import {createRoot} from 'react-dom/client';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import App from './App.tsx';
import AuthGate from './components/AuthGate';
import './index.css';

// Call the element loader after the platform has been bootstrapped
defineCustomElements(window);

createRoot(document.getElementById('root')!).render(
  <AuthGate>
    <App />
  </AuthGate>,
);
