import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Simple JWT verification (matches employee-auth)
function verifyJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    
    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const path = url.pathname.replace("/submit-evaluation", "");

  try {
    // Verify authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    
    if (!payload || !payload.employee_id) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const employeeId = payload.employee_id as string;

    // POST /save - Save evaluation draft (bypasses RLS)
    if (req.method === "POST" && (path === "/save" || path === "")) {
      const body = await req.json();
      const { 
        evaluation_id,
        period_year, 
        status, 
        employee_info_json, 
        quantitative_json, 
        qualitative_json, 
        summary_json 
      } = body;

      // Validate required fields
      if (!period_year) {
        return new Response(
          JSON.stringify({ error: "period_year is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const evalPayload = {
        employee_id: employeeId,
        period_year,
        status: status || 'draft',
        employee_info_json,
        quantitative_json,
        qualitative_json,
        summary_json,
      };

      if (evaluation_id) {
        // Update existing - verify ownership first
        const { data: existing } = await supabase
          .from('pep_evaluations')
          .select('employee_id')
          .eq('id', evaluation_id)
          .single();

        if (!existing || existing.employee_id !== employeeId) {
          return new Response(
            JSON.stringify({ error: "Not authorized to update this evaluation" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from('pep_evaluations')
          .update(evalPayload)
          .eq('id', evaluation_id);

        if (error) {
          console.error("Update error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to update evaluation" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, id: evaluation_id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Insert new
        const { data: insertedData, error } = await supabase
          .from('pep_evaluations')
          .insert(evalPayload)
          .select('id')
          .single();

        if (error) {
          console.error("Insert error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to create evaluation" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, id: insertedData.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // POST /submit - Submit evaluation (change status to submitted)
    if (req.method === "POST" && path === "/submit") {
      const body = await req.json();
      const { 
        evaluation_id,
        employee_info_json, 
        quantitative_json, 
        qualitative_json, 
        summary_json,
        pdf_url
      } = body;

      if (!evaluation_id) {
        return new Response(
          JSON.stringify({ error: "evaluation_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from('pep_evaluations')
        .select('employee_id')
        .eq('id', evaluation_id)
        .single();

      if (!existing || existing.employee_id !== employeeId) {
        return new Response(
          JSON.stringify({ error: "Not authorized to submit this evaluation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from('pep_evaluations')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          pdf_url: pdf_url || null,
          employee_info_json,
          quantitative_json,
          qualitative_json,
          summary_json,
        })
        .eq('id', evaluation_id);

      if (error) {
        console.error("Submit error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to submit evaluation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /reopen - Reopen a submitted evaluation (for managers)
    if (req.method === "POST" && path === "/reopen") {
      const body = await req.json();
      const { evaluation_id, reason } = body;

      if (!evaluation_id || !reason) {
        return new Response(
          JSON.stringify({ error: "evaluation_id and reason are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from('pep_evaluations')
        .update({
          status: 'reopened',
          reopened_at: new Date().toISOString(),
          reopened_by: employeeId,
          reopen_reason: reason,
        })
        .eq('id', evaluation_id);

      if (error) {
        console.error("Reopen error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to reopen evaluation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
