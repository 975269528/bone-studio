import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { restoreStartupProject } from './ui/project-actions';
import './styles.css';

await restoreStartupProject();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
