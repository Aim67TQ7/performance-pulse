import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "GET") {
      // Fetch orphan auth users (users without employee records)
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        throw new Error(`Failed to fetch auth users: ${authError.message}`);
      }

      // Get all employee user_ids
      const { data: employees, error: empError } = await supabaseAdmin
        .from("employees")
        .select("user_id, user_email");

      if (empError) {
        throw new Error(`Failed to fetch employees: ${empError.message}`);
      }

      const linkedUserIds = new Set(employees?.map(e => e.user_id).filter(Boolean));
      const linkedEmails = new Set(employees?.map(e => e.user_email?.toLowerCase()).filter(Boolean));

      // Filter to orphan users (not linked by user_id or email)
      const orphanUsers = authUsers.users.filter(user => {
        const email = user.email?.toLowerCase();
        return !linkedUserIds.has(user.id) && !linkedEmails.has(email);
      }).map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        // Try to extract badge from email (e.g., 00100@buntingmagnetics.com)
        suggested_badge: user.email?.match(/^(\d{5})@/)?.[1] || null,
        // Try to get name from metadata
        full_name: user.user_metadata?.full_name || null,
      }));

      return new Response(
        JSON.stringify({ 
          orphanUsers,
          totalAuthUsers: authUsers.users.length,
          totalLinked: linkedUserIds.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();

      // Check for auto-sync mode
      if (body.autoSync === true) {
        // Fetch all orphan auth users and create employees with placeholder names
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
          throw new Error(`Failed to fetch auth users: ${authError.message}`);
        }

        // Get all employee user_ids
        const { data: employees, error: empError } = await supabaseAdmin
          .from("employees")
          .select("user_id, user_email");

        if (empError) {
          throw new Error(`Failed to fetch employees: ${empError.message}`);
        }

        const linkedUserIds = new Set(employees?.map(e => e.user_id).filter(Boolean));
        const linkedEmails = new Set(employees?.map(e => e.user_email?.toLowerCase()).filter(Boolean));

        // Filter to orphan users
        const orphanUsers = authUsers.users.filter(user => {
          const email = user.email?.toLowerCase();
          return !linkedUserIds.has(user.id) && !linkedEmails.has(email);
        });

        const results = { created: 0, errors: [] as string[], total: orphanUsers.length };

        for (const user of orphanUsers) {
          const email = user.email || "";
          const badge = email.match(/^(\d{5})@/)?.[1] || null;
          
          // Use badge as placeholder name, or "Unknown" if no badge
          const firstName = "Badge";
          const lastName = badge || "Unknown";

          try {
            const { data: newEmployee, error: insertError } = await supabaseAdmin
              .from("employees")
              .insert({
                name_first: firstName,
                name_last: lastName,
                user_id: user.id,
                user_email: email,
                badge_number: badge,
                is_active: true,
                job_level: "Employee",
              })
              .select("id")
              .single();

            if (insertError) {
              results.errors.push(`Failed to create ${email}: ${insertError.message}`);
              continue;
            }

            // Set reports_to to self (root node)
            await supabaseAdmin
              .from("employees")
              .update({ reports_to: newEmployee.id })
              .eq("id", newEmployee.id);

            results.created++;
          } catch (err: any) {
            results.errors.push(`Exception for ${email}: ${err.message}`);
          }
        }

        return new Response(
          JSON.stringify(results),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Manual sync mode - create employee records for selected auth users
      const { users } = body;

      if (!Array.isArray(users) || users.length === 0) {
        return new Response(
          JSON.stringify({ error: "No users provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = { created: 0, errors: [] as string[] };

      for (const user of users) {
        const { auth_id, email, name_first, name_last, badge_number } = user;

        if (!auth_id || !name_first || !name_last) {
          results.errors.push(`Missing required fields for ${email}`);
          continue;
        }

        try {
          // First create employee without reports_to
          const { data: newEmployee, error: insertError } = await supabaseAdmin
            .from("employees")
            .insert({
              name_first: name_first.trim(),
              name_last: name_last.trim(),
              user_id: auth_id,
              user_email: email,
              badge_number: badge_number || null,
              is_active: true,
              job_level: "Employee",
            })
            .select("id")
            .single();

          if (insertError) {
            results.errors.push(`Failed to create ${email}: ${insertError.message}`);
            continue;
          }

          // Set reports_to to self (root node)
          await supabaseAdmin
            .from("employees")
            .update({ reports_to: newEmployee.id })
            .eq("id", newEmployee.id);

          results.created++;
        } catch (err: any) {
          results.errors.push(`Exception for ${email}: ${err.message}`);
        }
      }

      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
