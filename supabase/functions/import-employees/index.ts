import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmployeeRecord {
  id?: string;
  name_first: string;
  name_last: string;
  job_title?: string;
  department?: string;
  location?: string;
  badge_number?: string;
  user_email?: string;
  employee_number?: string;
  reports_to?: string;
  is_active?: boolean;
  hire_date?: string;
  benefit_class?: string;
  job_level?: string;
  business_unit?: string;
  work_category?: string;
}

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  linked: number;
  errors: { row: number; error: string }[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the user token
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is HR admin
    const { data: hrAdminCheck } = await supabase
      .from('hr_admin_users')
      .select('id')
      .eq('employee_id', user.id)
      .maybeSingle();

    // Also check via employees table
    const { data: employeeCheck } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let isHrAdmin = !!hrAdminCheck;
    if (!isHrAdmin && employeeCheck) {
      const { data: hrCheck2 } = await supabase
        .from('hr_admin_users')
        .select('id')
        .eq('employee_id', employeeCheck.id)
        .maybeSingle();
      isHrAdmin = !!hrCheck2;
    }

    if (!isHrAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. HR Admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { employees: importData } = await req.json() as { employees: EmployeeRecord[] };
    
    if (!Array.isArray(importData) || importData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No employee data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: ImportResult = {
      success: true,
      inserted: 0,
      updated: 0,
      linked: 0,
      errors: [],
    };

    // Process each employee
    for (let i = 0; i < importData.length; i++) {
      const emp = importData[i];
      
      try {
        // Validate required fields
        if (!emp.name_first?.trim() || !emp.name_last?.trim()) {
          result.errors.push({ row: i + 1, error: 'Missing required fields: name_first, name_last' });
          continue;
        }

        // Try to match user_id by email
        let userId: string | null = null;
        if (emp.user_email?.trim()) {
          const { data: matchedUserId } = await supabase.rpc('match_user_id_by_email', {
            p_email: emp.user_email.trim()
          });
          userId = matchedUserId || null;
          if (userId) {
            result.linked++;
          }
        }

        // Check if employee exists by ID or by matching email+name
        let existingEmployee = null;
        
        if (emp.id) {
          const { data } = await supabase
            .from('employees')
            .select('id')
            .eq('id', emp.id)
            .maybeSingle();
          existingEmployee = data;
        }
        
        if (!existingEmployee && emp.user_email) {
          const { data } = await supabase
            .from('employees')
            .select('id')
            .eq('user_email', emp.user_email.trim())
            .maybeSingle();
          existingEmployee = data;
        }

        // Build payload
        const payload: Record<string, unknown> = {
          name_first: emp.name_first.trim(),
          name_last: emp.name_last.trim(),
          job_title: emp.job_title?.trim() || null,
          department: emp.department?.trim() || null,
          location: emp.location?.trim() || null,
          badge_number: emp.badge_number?.trim() || null,
          user_email: emp.user_email?.trim() || null,
          employee_number: emp.employee_number?.trim() || null,
          is_active: emp.is_active !== false,
          hire_date: emp.hire_date || null,
          benefit_class: emp.benefit_class?.trim() || null,
          job_level: emp.job_level?.trim() || 'Employee',
          business_unit: emp.business_unit?.trim() || null,
          work_category: emp.work_category?.trim() || null,
          updated_at: new Date().toISOString(),
        };

        // Set user_id if found
        if (userId) {
          payload.user_id = userId;
        }

        if (existingEmployee) {
          // Update existing employee
          const { error: updateError } = await supabase
            .from('employees')
            .update(payload)
            .eq('id', existingEmployee.id);

          if (updateError) throw updateError;
          result.updated++;
        } else {
          // Insert new employee
          const { data: newEmp, error: insertError } = await supabase
            .from('employees')
            .insert(payload)
            .select('id')
            .single();

          if (insertError) throw insertError;
          
          // Set reports_to to self if not provided (root node)
          if (!emp.reports_to && newEmp) {
            await supabase
              .from('employees')
              .update({ reports_to: newEmp.id })
              .eq('id', newEmp.id);
          }
          
          result.inserted++;
        }
      } catch (error: any) {
        result.errors.push({ 
          row: i + 1, 
          error: error.message || 'Unknown error' 
        });
      }
    }

    result.success = result.errors.length === 0;

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
