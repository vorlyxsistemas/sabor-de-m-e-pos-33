import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Não autorizado' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !requestingUser) {
      return jsonResponse({ error: 'Token inválido' }, 401)
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .maybeSingle()

    if (roleData?.role !== 'admin') {
      return jsonResponse({ error: 'Apenas administradores podem editar usuários' }, 403)
    }

    const raw = await req.text()
    if (!raw) return jsonResponse({ error: 'Body JSON é obrigatório' }, 400)

    let body: any
    try {
      body = JSON.parse(raw)
    } catch {
      return jsonResponse({ error: 'Body inválido (JSON malformado)' }, 400)
    }

    const { user_id, name, phone, role } = body

    if (!user_id) {
      return jsonResponse({ error: 'ID do usuário é obrigatório' }, 400)
    }

    console.log('Updating user:', user_id)

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ name, phone })
      .eq('id', user_id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      return jsonResponse({ error: profileError.message }, 400)
    }

    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', user_id)

      if (roleError) {
        console.error('Error updating role:', roleError)
        // don't fail the whole request; profile already updated
      }
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    console.error('Error:', error)
    return jsonResponse({ error: error?.message ?? 'Erro desconhecido' }, 500)
  }
})
