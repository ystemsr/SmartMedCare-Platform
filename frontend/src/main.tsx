import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/index.css';
import './components/ui/ui.css';
import './styles/ref-layout.css';
import 'streamdown/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
