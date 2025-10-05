import React from 'react';

interface LoginModalProps {
  onLogin: () => void;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onClose }) => {
    return (
        <div className="fixed inset-0 bg-primary/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-secondary rounded-lg shadow-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-accent mb-4 text-center">Login</h2>
                <p className="text-center text-light/70 mb-6">Enter any credentials to proceed.</p>
                <form onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
                    <div className="space-y-4">
                        <input type="text" placeholder="Username" className="w-full bg-primary p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" />
                        <input type="password" placeholder="Password" className="w-full bg-primary p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" />
                    </div>
                    <button type="submit" className="w-full bg-accent text-primary font-bold py-3 mt-6 rounded-md hover:opacity-90 transition-opacity">
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginModal;
