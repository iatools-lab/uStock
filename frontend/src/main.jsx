import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/operations.css';
import './styles/tracking.css';
import './styles/director.css';
import './styles/overview.css';
import './styles/navigation-stock.css';
import './styles/commercial.css';
import './styles/stock-map.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);