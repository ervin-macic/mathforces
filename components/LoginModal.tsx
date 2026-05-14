import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { googleSignIn, GoogleAuthResult } from '../lib/apiClient';
import { setStoredAuth } from '../lib/auth';

interface LoginModalProps {
  onLogin: (user: GoogleAuthResult) => void;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSuccess = async (cred: CredentialResponse) => {
    if (!cred.credential) {
      setError('Google sign-in returned no credential. Try again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await googleSignIn(cred.credential);
      setStoredAuth({
        token: result.token,
        user: {
          userId: result.userId,
          username: result.username,
          displayName: result.displayName,
          email: result.email,
          picture: result.picture,
        },
      });
      onLogin(result);
    } catch (err) {
      console.error('[Mathforces] Google sign-in failed', err);
      setError('Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleError = () => {
    setError('Google sign-in was cancelled or failed.');
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-secondary rounded-lg shadow-2xl p-8 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-accent mb-2 text-center">Sign in</h2>
        <p className="text-center text-light/70 mb-6 text-sm">
          Sign in or create your account with Google to save your progress and
          appear on the leaderboard.
        </p>

        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            theme="filled_black"
            text="signin_with"
            shape="rectangular"
            width="280"
          />
        </div>

        {busy && (
          <p className="text-center text-light-secondary text-sm">Signing you in…</p>
        )}
        {error && (
          <p className="text-center text-red-400 text-sm mt-2">{error}</p>
        )}

        <p className="text-center text-light/40 text-xs mt-6">
          By continuing you agree to our terms.
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
