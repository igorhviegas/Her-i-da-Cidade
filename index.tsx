
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Favicon served from public/images (moved for production)
const faviconUrl = '/images/favicon.ico';
const existingLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
if (existingLink) {
  existingLink.href = faviconUrl;
} else {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = faviconUrl;
  document.head.appendChild(link);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
