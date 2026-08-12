'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/rbac';

const PASSKEY_SESSION_KEY = 'toque_passkey_session';

export interface PasskeySession {
  email: string;
  name: string;
  role: UserRole;
}

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [authMethod, setAuthMethod] = useState<'supabase' | 'passkey' | null>(null);
  const supabase = createClient();

  const fetchUserRole = useCallback(
    async (userId: string, fallback: UserRole | null = null) => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (!error && data?.role) {
          setUserRole(data.role as UserRole);
        } else {
          setUserRole(fallback ?? 'viewer');
        }
      } catch {
        setUserRole(fallback ?? 'viewer');
      }
    },
    [supabase]
  );

  const readPasskeySession = useCallback((): PasskeySession | null => {
    try {
      const raw = localStorage.getItem(PASSKEY_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PasskeySession;
      if (!parsed?.email) return null;
      return {
        email: parsed.email,
        name: parsed.name || 'Passkey User',
        role: parsed.role || 'operator',
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const {
        data: { session: supabaseSession },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (supabaseSession?.user) {
        setSession(supabaseSession);
        setUser(supabaseSession.user);
        setAuthMethod('supabase');
        await fetchUserRole(supabaseSession.user.id);
      } else {
        const passkey = readPasskeySession();
        if (passkey) {
          setUser({
            id: `passkey:${passkey.email}`,
            email: passkey.email,
            user_metadata: { full_name: passkey.name },
          });
          setSession({ passkey: true });
          setAuthMethod('passkey');
          setUserRole(passkey.role);
        } else {
          setUserRole(null);
          setAuthMethod(null);
        }
      }
      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setAuthMethod('supabase');
        await fetchUserRole(nextSession.user.id);
      } else {
        const passkey = readPasskeySession();
        if (passkey) {
          setUser({
            id: `passkey:${passkey.email}`,
            email: passkey.email,
            user_metadata: { full_name: passkey.name },
          });
          setSession({ passkey: true });
          setAuthMethod('passkey');
          setUserRole(passkey.role);
        } else {
          setUser(null);
          setSession(null);
          setAuthMethod(null);
          setUserRole(null);
        }
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserRole, readPasskeySession]);

  const signUp = async (email: string, password: string, metadata = {}) => {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: (metadata as any)?.fullName || '',
          username: (metadata as any)?.username || email.split('@')[0],
          avatar_url: (metadata as any)?.avatarUrl || '',
        },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    localStorage.removeItem(PASSKEY_SESSION_KEY);
    try {
      await supabase.auth.signOut();
    } catch {
      // local passkey session still cleared above
    }
    setUser(null);
    setSession(null);
    setAuthMethod(null);
    setUserRole(null);
  };

  const getCurrentUser = async () => {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return currentUser;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at != null;
  };

  const getUserProfile = async () => {
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id.replace(/^passkey:/, ''))
      .single();
    if (error) throw error;
    return data;
  };

  const logAudit = async (action: string, panel?: string, details?: Record<string, any>) => {
    if (!user) return;
    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id.startsWith('passkey:') ? null : user.id,
        user_email: user.email ?? null,
        action,
        panel: panel ?? null,
        details: details ?? {},
      });
    } catch {
      // Silently fail — audit logging should not break the app
    }
  };

  const refreshRole = useCallback(async () => {
    if (authMethod === 'passkey') {
      const passkey = readPasskeySession();
      if (passkey) setUserRole(passkey.role);
      return;
    }
    if (user?.id) {
      await fetchUserRole(user.id);
    }
  }, [authMethod, user?.id, fetchUserRole, readPasskeySession]);

  const resolveUsername = useCallback(
    async (username: string): Promise<string | null> => {
      const raw = username.trim();
      if (!raw) return null;
      if (raw.includes('@')) return raw.toLowerCase();

      try {
        const { data, error } = await supabase.rpc('resolve_login_identity', {
          p_username: raw,
        });
        if (!error && typeof data === 'string' && data) return data;
      } catch {
        // fall through to client-side known accounts
      }

      const known: Record<string, string> = {
        rhsalisu: 'rhsalisu@gmail.com',
        admin: 'admin@toqueui.com',
        operator: 'operator@toqueui.com',
        viewer: 'viewer@toqueui.com',
      };
      return known[raw.toLowerCase()] ?? null;
    },
    [supabase]
  );

  const passkeySignIn = useCallback(async (identity: Partial<PasskeySession>) => {
    const sessionData: PasskeySession = {
      email: identity.email || 'operator@toqueui.com',
      name: identity.name || 'Passkey Operator',
      role: identity.role || 'operator',
    };
    localStorage.setItem(PASSKEY_SESSION_KEY, JSON.stringify(sessionData));
    setUser({
      id: `passkey:${sessionData.email}`,
      email: sessionData.email,
      user_metadata: { full_name: sessionData.name },
    });
    setSession({ passkey: true });
    setAuthMethod('passkey');
    setUserRole(sessionData.role);
    setLoading(false);
    return sessionData;
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      userRole,
      authMethod,
      signUp,
      signIn,
      signOut,
      getCurrentUser,
      isEmailVerified,
      getUserProfile,
      logAudit,
      refreshRole,
      resolveUsername,
      passkeySignIn,
    }),
    [user, session, loading, userRole, authMethod, refreshRole, resolveUsername, passkeySignIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
