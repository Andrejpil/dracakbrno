import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is admin
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id || user_id === caller.id) {
    return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400 });
  }

  // Delete user data first
  await supabase.from('xp_archive').delete().eq('user_id', user_id);
  await supabase.from('battle_monsters').delete().eq('user_id', user_id);
  await supabase.from('monster_kills').delete().eq('user_id', user_id);
  await supabase.from('heroes').delete().eq('user_id', user_id);
  await supabase.from('monsters').delete().eq('user_id', user_id);
  await supabase.from('map_points').delete().eq('user_id', user_id);
  await supabase.from('map_routes').delete().eq('user_id', user_id);
  await supabase.from('map_settings').delete().eq('user_id', user_id);
  await supabase.from('user_roles').delete().eq('user_id', user_id);
  await supabase.from('profiles').delete().eq('id', user_id);

  // Delete auth user
  const { error } = await supabase.auth.admin.deleteUser(user_id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
