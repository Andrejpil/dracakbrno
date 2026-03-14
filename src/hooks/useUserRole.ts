import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'admin' | 'editor' | 'viewer';

interface UserWithRole {
  id: string;
  email: string;
  role: AppRole;
}

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRole(null); setLoading(false); return; }
    initRole();
  }, [user]);

  async function initRole() {
    if (!user) return;
    setLoading(true);

    // Upsert profile
    await supabase.from('profiles').upsert(
      { id: user.id, email: user.email || '' },
      { onConflict: 'id' }
    );

    // Check existing role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roles && roles.length > 0) {
      setRole(roles[0].role as AppRole);
    } else {
      // Check if ANY roles exist - if not, make this user admin
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true });

      const assignRole: AppRole = count === 0 ? 'admin' : 'viewer';
      await supabase.from('user_roles').insert({ user_id: user.id, role: assignRole });
      setRole(assignRole);
    }
    setLoading(false);
  }

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor' || role === 'admin';

  const getAllUsers = useCallback(async (): Promise<UserWithRole[]> => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');
    if (!profiles) return [];

    return profiles.map((p: any) => {
      const userRole = roles?.find((r: any) => r.user_id === p.id);
      return { id: p.id, email: p.email, role: (userRole?.role as AppRole) || 'viewer' };
    });
  }, []);

  const setUserRole = useCallback(async (userId: string, newRole: AppRole) => {
    // Delete existing role and insert new one
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
  }, []);

  return { role, loading, isAdmin, isEditor, getAllUsers, setUserRole };
}
