'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface CredentialUserHandle {
  email?: string;
  name?: string;
}

function decodeUserHandle(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  try {
    return new TextDecoder().decode(new Uint8Array(buffer)).trim();
  } catch {
    return '';
  }
}

const DEMO_ACCOUNTS = [
  {
    username: 'rhsalisu',
    email: 'rhsalisu@gmail.com',
    password: 'Admin@2024!',
    role: 'Super Admin',
  },
  { username: 'admin', email: 'admin@toqueui.com', password: 'admin123', role: 'Admin' },
  {
    username: 'operator',
    email: 'operator@toqueui.com',
    password: 'operator123',
    role: 'Operator',
  },
  { username: 'viewer', email: 'viewer@toqueui.com', password: 'viewer123', role: 'Viewer' },
];

export default function LoginPage() {
  const router = useRouter();
  const { signIn, passkeySignIn, resolveUsername } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasWebAuthn =
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof window.PublicKeyCredential !== 'undefined';
    setPasskeySupported(hasWebAuthn);
  }, []);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const matchedDemo = useMemo(
    () => DEMO_ACCOUNTS.find((a) => a.username === username.trim().toLowerCase()),
    [username]
  );

  const redirectToDashboard = () => {
    router.push('/dashboard');
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }
    setLoading(true);
    try {
      const email = await resolveUsername(username);
      if (!email) {
        setError(
          `No account found for "${username.trim()}". Check the username or use a full email.`
        );
        setLoading(false);
        return;
      }
      await signIn(email, password);
      setSuccessMsg(`Authenticated as ${email} — redirecting…`);
      setTimeout(redirectToDashboard, 600);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    clearMessages();
    if (!passkeySupported) {
      setError(
        'Passkeys are not supported here — use HTTPS with a modern browser (Chrome, Edge, Safari).'
      );
      return;
    }
    setPasskeyLoading(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'preferred',
        allowCredentials: [],
        timeout: 60000,
      };

      const credential = (await (navigator as any).credentials.get({
        publicKey,
      })) as PublicKeyCredential | null;

      if (!credential) {
        setError('Passkey verification was cancelled.');
        return;
      }

      const rawHandle = (credential.response as AuthenticatorAssertionResponse).userHandle;
      const handle = decodeUserHandle(rawHandle ?? null);

      let identity: Partial<{ email: string; name: string }> = {};
      if (handle && (handle.includes('@') || handle.length > 3)) {
        identity = handle.includes('@')
          ? { email: handle }
          : { email: `${handle}@toqueui.com`, name: handle };
      }

      await passkeySignIn(identity);
      setSuccessMsg('Passkey verified — redirecting…');
      setTimeout(redirectToDashboard, 600);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Passkey verification was cancelled or timed out.');
      } else if (err?.name === 'NotSupportedError') {
        setError('This device has no compatible passkey. Register one or use your password.');
      } else {
        setError(err?.message || 'Passkey authentication failed.');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();
    try {
      const email = await resolveUsername(username);
      if (!email) {
        setError('Enter your username or email first to request a reset link.');
        return;
      }
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { error: resetError } = await (
        await import('@/lib/supabase/client')
      )
        .createClient()
        .auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
        });
      if (resetError) throw resetError;
      setSuccessMsg(`Password reset link sent to ${email}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset link.');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 20% 30%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 80% 70%, rgba(129,140,248,0.06) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-4">
            <AppLogo size={36} />
            <span
              className="text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}
            >
              ToqueUI
            </span>
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            Nusuk Visa Operations Command Center
          </p>
          <div
            className="mt-3 px-3 py-1 rounded-full text-xs font-mono font-medium"
            style={{
              backgroundColor: 'rgba(99,102,241,0.1)',
              color: 'var(--accent)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            Username / Password · Passkey enabled
          </div>
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.05)',
          }}
        >
          <div className="p-6">
            {error && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg mb-4 text-sm"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: 'var(--error)',
                }}
              >
                <Icon name="ExclamationTriangleIcon" size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg mb-4 text-sm"
                style={{
                  backgroundColor: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: 'var(--success)',
                }}
              >
                <Icon name="CheckCircleIcon" size={15} className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Icon name="UserIcon" size={14} style={{ color: 'var(--muted-foreground)' }} />
                  </span>
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="operator or operator@organisation.com"
                    className="input-field w-full pl-9 pr-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs transition-colors"
                    style={{ color: 'var(--accent)' }}
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Icon
                      name="LockClosedIcon"
                      size={14}
                      style={{ color: 'var(--muted-foreground)' }}
                    />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="input-field w-full pl-9 pr-10 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRememberMe((v) => !v)}
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                  style={{
                    backgroundColor: rememberMe ? 'var(--primary)' : 'var(--input)',
                    border: `1px solid ${rememberMe ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  {rememberMe && <Icon name="CheckIcon" size={10} style={{ color: 'white' }} />}
                </button>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Keep me signed in for 30 days
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || passkeyLoading}
                className="btn-primary w-full py-2.5 text-sm font-semibold mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRightOnRectangleIcon" size={15} />
                    Sign in
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                or continue with
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            <button
              type="button"
              onClick={handlePasskeySignIn}
              disabled={passkeyLoading || loading || !passkeySupported}
              className="btn-ghost w-full py-2.5 text-sm font-semibold"
              style={!passkeySupported ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {passkeyLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  Waiting for authenticator…
                </>
              ) : (
                <>
                  <Icon name="FingerPrintIcon" size={16} />
                  Sign in with Passkey
                </>
              )}
            </button>
            {mounted && (
              <p
                className="text-center mt-2 text-2xs"
                style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}
              >
                {passkeySupported
                  ? 'Face ID · Touch ID · Windows Hello · Security key'
                  : 'Passkeys need HTTPS and a WebAuthn-capable browser'}
              </p>
            )}
          </div>

          <div
            className="px-6 py-4"
            style={{ borderTop: '1px solid var(--border)', backgroundColor: 'rgba(0,0,0,0.15)' }}
          >
            <p
              className="text-xs font-semibold mb-2 flex items-center gap-1.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <Icon name="InformationCircleIcon" size={12} />
              Demo accounts
            </p>
            <div className="space-y-1">
              {DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.email}
                  className="flex items-center justify-between text-xs font-mono"
                >
                  <span style={{ color: 'var(--foreground)' }}>{acc.username}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    {acc.password} · {acc.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border)', backgroundColor: 'rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center gap-1.5">
              <Icon name="ShieldCheckIcon" size={12} style={{ color: 'var(--success)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                TLS 1.3 · End-to-end encrypted
              </span>
            </div>
            <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
              v2.0 · Enterprise
            </span>
          </div>
        </div>

        <div className="mt-5 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-xs transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
