import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const GOOGLE_CLIENT_ID =
  ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

if (!GOOGLE_CLIENT_ID) {
  console.warn(
    '[Mathforces] VITE_GOOGLE_CLIENT_ID is not set — Google sign-in will not work. ' +
    'Create an OAuth Web Client ID at https://console.cloud.google.com/apis/credentials ' +
    'and add it to .env.local.',
  );
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
