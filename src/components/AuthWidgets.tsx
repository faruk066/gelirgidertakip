import { useState, useEffect } from 'react';
import { supabase } from '../lib/auth';
import type { Session, User } from '@supabase/supabase-js';

/** Auth state management — oturum süresi dolduğunda /auth yönlendirir */
export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading, supabase };
};

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export const useProfile = () => {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!session?.user || !supabase) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .eq('id', session.user.id);
        if (error) {
          setLoading(false);
          return;
        }
        setProfile(data && data.length > 0 ? data[0] : null);
      } catch {
        /* yoksay */
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [session?.user]);

  return { profile, loading };
};

export const useWorkspace = () => {
  const { session } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!session?.user || !supabase) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ggt_workspaces')
          .select('id')
          .eq('owner_id', session.user.id);
        if (error) setWorkspaceId(null);
        else setWorkspaceId(data && data.length > 0 ? data[0].id : null);
      } catch {
        setWorkspaceId(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [session?.user]);

  return { workspaceId, loading };
};

export const SignOutButton = () => {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <button
      type="button"
      onClick={() => supabase.auth.signOut()}
      className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
    >
      �Logout
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
