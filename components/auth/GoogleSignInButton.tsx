import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: { id: {
        initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
        renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
      }};
    };
  }
}

interface Props {
  onCredential: (credential: string) => Promise<void> | void;
  disabled?: boolean;
}

export default function GoogleSignInButton({ onCredential, disabled }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID;

  useEffect(() => {
    if (!clientId || disabled) return;
    const render = () => {
      if (!window.google || !container.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => void onCredential(credential),
      });
      container.current.innerHTML = '';
      window.google.accounts.id.renderButton(container.current, {
        theme: 'outline', size: 'large', width: container.current.clientWidth || 360,
        text: 'continue_with', shape: 'rectangular', logo_alignment: 'left',
      });
    };
    if (window.google) { render(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    script.onerror = () => setError('Google sign-in could not be loaded');
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, [clientId, disabled, onCredential]);

  if (!clientId) return <p style={{ color: '#64748b', fontSize: 13 }}>Google sign-in is not configured yet.</p>;
  return <>{error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}<div ref={container} aria-label="Continue with Google" /></>;
}
