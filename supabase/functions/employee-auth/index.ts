import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const TOKEN_EXPIRY_HOURS = 8;

// Simple JWT implementation
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createJWT(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_EXPIRY_HOURS * 60 * 60;
  
  const fullPayload = { ...payload, iat: now, exp };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`)
    ))
  );
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

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
  const path = url.pathname.replace("/employee-auth", "");

  try {
    // POST /login
    if (req.method === "POST" && (path === "/login" || path === "")) {
      const { email, password } = await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find employee by email
      const { data: employee, error: findError } = await supabase
        .from("employees")
        .select("id, name_first, name_last, user_email, job_title, department, job_level, badge_pin_hash, badge_pin_attempts, badge_pin_locked_until, badge_pin_is_default, is_active, reports_to")
        .eq("user_email", email.toLowerCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (findError || !employee) {
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if account is locked
      if (employee.badge_pin_locked_until) {
        const lockoutEnd = new Date(employee.badge_pin_locked_until);
        if (lockoutEnd > new Date()) {
          const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
          return new Response(
            JSON.stringify({ 
              error: `Account is locked. Try again in ${minutesRemaining} minute(s).`,
              locked: true,
              minutes_remaining: minutesRemaining
            }),
            { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Check if password is set
      if (!employee.badge_pin_hash) {
        // No password set - this is first login, generate temp token for password setup
        const tempToken = createJWT({
          employee_id: employee.id,
          email: employee.user_email,
          temp: true,
          purpose: "set_password"
        });

        return new Response(
          JSON.stringify({
            requires_password_setup: true,
            temp_token: tempToken,
            employee: {
              id: employee.id,
              name_first: employee.name_first,
              name_last: employee.name_last,
              user_email: employee.user_email,
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, employee.badge_pin_hash);

      if (!passwordValid) {
        // Increment failed attempts
        const attempts = (employee.badge_pin_attempts || 0) + 1;
        const updateData: Record<string, unknown> = { badge_pin_attempts: attempts };

        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          const lockoutEnd = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
          updateData.badge_pin_locked_until = lockoutEnd.toISOString();
        }

        await supabase
          .from("employees")
          .update(updateData)
          .eq("id", employee.id);

        const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;
        return new Response(
          JSON.stringify({ 
            error: remainingAttempts > 0 
              ? `Invalid password. ${remainingAttempts} attempt(s) remaining.`
              : `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
            remaining_attempts: Math.max(0, remainingAttempts)
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Success! Reset attempts and create token
      await supabase
        .from("employees")
        .update({ 
          badge_pin_attempts: 0, 
          badge_pin_locked_until: null 
        })
        .eq("id", employee.id);

      const token = createJWT({
        employee_id: employee.id,
        email: employee.user_email,
        name: `${employee.name_first} ${employee.name_last}`
      });

      return new Response(
        JSON.stringify({
          token,
          must_set_password: employee.badge_pin_is_default === true,
          employee: {
            id: employee.id,
            name_first: employee.name_first,
            name_last: employee.name_last,
            user_email: employee.user_email,
            job_title: employee.job_title,
            department: employee.department,
            job_level: employee.job_level,
            reports_to: employee.reports_to
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /set-password
    if (req.method === "POST" && path === "/set-password") {
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

      const { new_password, current_password } = await req.json();

      if (!new_password || new_password.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const employeeId = payload.employee_id as string;

      // Get current employee data
      const { data: employee } = await supabase
        .from("employees")
        .select("badge_pin_hash, badge_pin_is_default")
        .eq("id", employeeId)
        .single();

      // If not a temp token and password exists, verify current password
      if (!payload.temp && employee?.badge_pin_hash && !employee?.badge_pin_is_default) {
        if (!current_password) {
          return new Response(
            JSON.stringify({ error: "Current password is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const currentValid = await bcrypt.compare(current_password, employee.badge_pin_hash);
        if (!currentValid) {
          return new Response(
            JSON.stringify({ error: "Current password is incorrect" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(new_password);

      const { error: updateError } = await supabase
        .from("employees")
        .update({
          badge_pin_hash: hashedPassword,
          badge_pin_is_default: false,
          badge_pin_attempts: 0,
          badge_pin_locked_until: null
        })
        .eq("id", employeeId);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get full employee data for new token
      const { data: updatedEmployee } = await supabase
        .from("employees")
        .select("id, name_first, name_last, user_email, job_title, department, job_level, reports_to")
        .eq("id", employeeId)
        .single();

      // Issue new full token
      const newToken = createJWT({
        employee_id: employeeId,
        email: updatedEmployee?.user_email,
        name: `${updatedEmployee?.name_first} ${updatedEmployee?.name_last}`
      });

      return new Response(
        JSON.stringify({
          success: true,
          token: newToken,
          employee: updatedEmployee
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /verify-token
    if (req.method === "POST" && path === "/verify-token") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.substring(7);
      const payload = verifyJWT(token);

      if (!payload || payload.temp) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch current employee data
      const { data: employee } = await supabase
        .from("employees")
        .select("id, name_first, name_last, user_email, job_title, department, job_level, reports_to, badge_pin_is_default, is_active")
        .eq("id", payload.employee_id as string)
        .single();

      if (!employee || !employee.is_active) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          must_set_password: employee.badge_pin_is_default === true,
          employee: {
            id: employee.id,
            name_first: employee.name_first,
            name_last: employee.name_last,
            user_email: employee.user_email,
            job_title: employee.job_title,
            department: employee.department,
            job_level: employee.job_level,
            reports_to: employee.reports_to
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
