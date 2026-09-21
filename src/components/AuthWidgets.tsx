import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  supabase: SupabaseClient | null;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  supabase,
});

/** Tek auth state kaynağı — tüm uygulama aynı session'ı paylaşır */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading, supabase }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Auth state management — AuthProvider içindeki tek session'ı okur */
export const useAuth = () => useContext(AuthContext);

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_admin: boolean;
  created_at?: string | null;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user || !supabase) {
        setProfile(null);
        // Kullanıcı yoksa bekleyecek bir şey yok; yoksa RequireAdmin takılır
        setLoaded(!user ? true : false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, is_admin, created_at')
          .eq('id', user.id);
        if (error) {
          setProfile(null);
          return;
        }
        const row = (data ?? [])[0] as Profile | undefined;
        // Eski satırlarda is_admin kolonu yoksa role='admin' de admin say
        if (row && !row.is_admin && row.role === 'admin') row.is_admin = true;
        setProfile(row ?? null);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };
    void load();
  }, [user?.id]);

  const isAdmin = profile?.is_admin === true || profile?.role === 'admin';
  return { profile, loading, loaded, isAdmin };
};

export const useWorkspace = () => {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user || !supabase) {
        // Çıkışta workspace göstergesini temizle (başka hesaba karışmasın)
        setWorkspaceId(null);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ggt_workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1);
        if (error) setWorkspaceId(null);
        else {
          const row = (data ?? [])[0] as { workspace_id: string } | undefined;
          setWorkspaceId(row?.workspace_id ?? null);
        }
      } catch {
        setWorkspaceId(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  return { workspaceId, loading };
};

export const SignOutButton = () => {
  const { session, supabase: client } = useAuth();
  if (!session || !client) return null;
  return (
    <button
      type="button"
      onClick={() => {
        // Kullanıcı değişiminde eski hesabın workspace kimliği kalmasın
        try {
          localStorage.removeItem('ggt-workspace-id');
        } catch {
          /* yoksay */
        }
        void client.auth.signOut();
      }}
      className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
    >
      Çıkış Yap
    </button>
  );
};

export const WorkspaceInfo = () => {
  const { workspaceId } = useWorkspace();
  if (!workspaceId) return null;
  return (
    <span className="text-xs text-slate-400 dark:text-slate-500">
      • WS: {workspaceId.slice(0, 8)}
    </span>
  );
};
