import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { entries, from, to, era } = await req.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ summary: 'Žádné zápisky v tomto období.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) throw new Error('LOVABLE_API_KEY not configured');

    const formatted = entries
      .map((e: any) => `[${e.entry_day}.${e.entry_month}.${e.entry_year}] ${e.author_name || 'Neznámý'}: ${e.content}`)
      .join('\n\n');

    const prompt = `Jsi kronikář ve fantasy světě Dračí Doupě. Shrň následující zápisky hráčů z období ${from} až ${to} (${era}) do souvislé kroniky v češtině. Zachovej chronologii, jména postav a klíčové události. Piš epickým, ale srozumitelným stylem.\n\nZÁPISKY:\n${formatted}`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Překročen limit požadavků. Zkuste to za chvíli.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'Vyčerpány AI kredity. Doplňte je v nastavení workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI Gateway ${res.status}: ${t}`);
    }
    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || 'Nepodařilo se vytvořit shrnutí.';
    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
