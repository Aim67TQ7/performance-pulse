import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JWT_SECRET = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EmployeePayload {
  id?: string;
  name_first: string;
  name_last: string;
  job_title?: string | null;
  department?: string | null;
  location?: string | null;
  badge_number?: string | null;
  user_email?: string | null;
  employee_number?: string | null;
  reports_to?: string | null;
  is_active?: boolean;
  hire_date?: string | null;
  benefit_class?: string | null;
  job_level?: string | null;
  business_unit?: string | null;
  work_category?: string | null;
}

// Base64URL decode
function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Verify JWT with real HMAC-SHA256
async function verifyJWT(token: string): Promise<{ valid: boolean; payload?: Record<string, unknown> }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };
    
    const [header, payload, signature] = parts;
    const signatureInput = `${header}.${payload}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const signatureBytes = base64UrlDecode(signature);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes.buffer as ArrayBuffer,
      encoder.encode(signatureInput)
    );
    
    if (!isValid) return { valid: false };
    
    const payloadJson = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    
    // Check expiration
    if (payloadJson.exp && payloadJson.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }
    
    return { valid: true, payload: payloadJson };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { valid, payload } = await verifyJWT(token);
    
    if (!valid || !payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is HR admin from token
    if (!payload.is_hr_admin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. HR Admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    // Route based on action
    if (action === 'create' && req.method === 'POST') {
      const employee: EmployeePayload = await req.json();
      
      // Validate required fields
      if (!employee.name_first?.trim() || !employee.name_last?.trim()) {
        return new Response(
          JSON.stringify({ error: 'First and last name are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const insertPayload = {
        name_first: employee.name_first.trim(),
        name_last: employee.name_last.trim(),
        job_title: employee.job_title?.trim() || null,
        department: employee.department || null,
        location: employee.location || null,
        badge_number: employee.badge_number?.trim() || null,
        user_email: employee.user_email?.trim() || null,
        employee_number: employee.employee_number?.trim() || null,
        is_active: employee.is_active !== false,
        hire_date: employee.hire_date || null,
        benefit_class: employee.benefit_class || null,
        job_level: employee.job_level || 'Employee',
        business_unit: employee.business_unit || null,
        work_category: employee.work_category || null,
      };

      const { data: newEmp, error: insertError } = await supabase
        .from('employees')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Set reports_to - either to provided value or self (for root nodes)
      const reportsTo = employee.reports_to || newEmp.id;
      await supabase
        .from('employees')
        .update({ reports_to: reportsTo })
        .eq('id', newEmp.id);

      return new Response(
        JSON.stringify({ success: true, id: newEmp.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update' && req.method === 'PUT') {
      const employee: EmployeePayload = await req.json();
      
      if (!employee.id) {
        return new Response(
          JSON.stringify({ error: 'Employee ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If reports_to is empty/null, set to self (root node) to satisfy FK constraint
      const reportsTo = employee.reports_to || employee.id;

      const updatePayload = {
        name_first: employee.name_first?.trim(),
        name_last: employee.name_last?.trim(),
        job_title: employee.job_title?.trim() || null,
        department: employee.department || null,
        location: employee.location || null,
        badge_number: employee.badge_number?.trim() || null,
        user_email: employee.user_email?.trim() || null,
        employee_number: employee.employee_number?.trim() || null,
        reports_to: reportsTo,
        is_active: employee.is_active,
        hire_date: employee.hire_date || null,
        benefit_class: employee.benefit_class || null,
        job_level: employee.job_level || 'Employee',
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', employee.id);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete' && req.method === 'DELETE') {
      const { id } = await req.json();
      
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Employee ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
