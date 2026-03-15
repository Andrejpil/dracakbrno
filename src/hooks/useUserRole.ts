import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'admin' | 'editor' | 'viewer';

interface UserWithRole {
  id: string;
  email: string;
  role: AppRole;
}

export interface Permission {
  page: string;
  can_view: boolean;
  can_edit: boolean;
}

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRole(null); setPermissions([]); setLoading(false); return; }
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

    // Use server-side function for safe role assignment
    const { data: assignedRole } = await supabase.rpc('assign_default_role', { p_user_id: user.id });
    const currentRole = (assignedRole as AppRole) || 'viewer';
    setRole(currentRole);

    // Load permissions for this role
    if (currentRole !== 'admin') {
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', currentRole);
      setPermissions((perms || []).map((p: any) => ({
        page: p.page,
        can_view: p.can_view,
        can_edit: p.can_edit,
      })));
    }
    setLoading(false);
  }

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor' || role === 'admin';

  const canView = useCallback((page: string) => {
    if (role === 'admin') return true;
    const perm = permissions.find(p => p.page === page);
    return perm?.can_view ?? false;
  }, [role, permissions]);

  const canEdit = useCallback((page: string) => {
    if (role === 'admin') return true;
    const perm = permissions.find(p => p.page === page);
    return perm?.can_edit ?? false;
  }, [role, permissions]);

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
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await supabase.functions.invoke('delete-user', {
      body: { user_id: userId },
    });
    if (res.error) throw res.error;
  }, []);

  const getPermissions = useCallback(async (forRole: AppRole): Promise<Permission[]> => {
    const { data } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role', forRole);
    return (data || []).map((p: any) => ({
      page: p.page,
      can_view: p.can_view,
      can_edit: p.can_edit,
    }));
  }, []);

  const updatePermission = useCallback(async (forRole: AppRole, page: string, can_view: boolean, can_edit: boolean) => {
    await supabase
      .from('role_permissions')
      .update({ can_view, can_edit })
      .eq('role', forRole)
      .eq('page', page);
  }, []);

  return {
    role, loading, isAdmin, isEditor,
    canView, canEdit,
    getAllUsers, setUserRole, deleteUser,
    getPermissions, updatePermission,
  };
}
