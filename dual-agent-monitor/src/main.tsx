import React from 'react';
import ReactDOM from 'react-dom/client';
import { EnterpriseApp } from './EnterpriseApp.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EnterpriseApp />
  </React.StrictMode>,
);