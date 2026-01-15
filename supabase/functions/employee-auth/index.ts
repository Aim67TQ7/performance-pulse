import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Helper to lookup supervisor name by ID
// deno-lint-ignore no-explicit-any
async function getSupervisorName(supabase: any, supervisorId: string | null): Promise<string | null> {
  if (!supervisorId) return null;
  
  const { data: supervisor } = await supabase
    .from("employees")
    .select("name_first, name_last")
    .eq("id", supervisorId)
    .single();
  
  if (supervisor?.name_first) {
    return `${supervisor.name_first} ${supervisor.name_last}`;
  }
  return null;
}

// Password hashing using Web Crypto API (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  return btoa(String.fromCharCode(...combined));
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedKey = combined.slice(16);
    
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
    const derivedKey = new Uint8Array(derivedBits);
    
    // Constant-time comparison
    if (derivedKey.length !== storedKey.length) return false;
    let result = 0;
    for (let i = 0; i < derivedKey.length; i++) {
      result |= derivedKey[i] ^ storedKey[i];
    }
    return result === 0;
  } catch {
    return false;
  }
}

// Real HS256 JWT implementation using WebCrypto
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createJWT(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_EXPIRY_HOURS * 60 * 60;
  
  const fullPayload = { ...payload, iat: now, exp };
  
  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  // Create HMAC-SHA256 signature using WebCrypto
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signatureInput)
  );
  
  const encodedSignature = base64UrlEncode(signatureBuffer);
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Verify signature using WebCrypto
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const signatureInput = `${headerB64}.${payloadB64}`;
    const signatureBytes = base64UrlDecode(signatureB64);
    // Create a new ArrayBuffer copy for crypto.subtle.verify
    const signatureBuffer = new Uint8Array(signatureBytes).buffer;
    
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      encoder.encode(signatureInput)
    );
    
    if (!isValid) {
      console.log("[employee-auth] Invalid JWT signature");
      return null;
    }
    
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    
    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log("[employee-auth] JWT expired");
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error("[employee-auth] JWT verification error:", error);
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

      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find employee by email
      const { data: employee, error: findError } = await supabase
        .from("employees")
        .select("id, name_first, name_last, user_email, job_title, department, job_level, location, business_unit, benefit_class, hire_date, employee_number, badge_number, badge_pin_hash, badge_pin_attempts, badge_pin_locked_until, badge_pin_is_default, is_active, reports_to, is_hr_admin")
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
        const tempToken = await createJWT({
          employee_id: employee.id,
          email: employee.user_email,
          temp: true,
          purpose: "set_password"
        });

        // Lookup supervisor name
        const supervisorName = await getSupervisorName(supabase, employee.reports_to);

        return new Response(
          JSON.stringify({
            requires_password_setup: true,
            temp_token: tempToken,
            employee: {
              id: employee.id,
              name_first: employee.name_first,
              name_last: employee.name_last,
              user_email: employee.user_email,
              job_title: employee.job_title,
              department: employee.department,
              job_level: employee.job_level,
              location: employee.location,
              business_unit: employee.business_unit,
              benefit_class: employee.benefit_class,
              hire_date: employee.hire_date,
              employee_number: employee.employee_number,
              badge_number: employee.badge_number,
              reports_to: employee.reports_to,
              supervisor_name: supervisorName,
              is_hr_admin: employee.is_hr_admin || false
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Password is required for login if hash exists
      if (!password) {
        return new Response(
          JSON.stringify({ error: "Password is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const passwordValid = await verifyPassword(password, employee.badge_pin_hash);

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

      const token = await createJWT({
        employee_id: employee.id,
        email: employee.user_email,
        name: `${employee.name_first} ${employee.name_last}`,
        is_hr_admin: employee.is_hr_admin || false
      });

      // Lookup supervisor name
      const supervisorName = await getSupervisorName(supabase, employee.reports_to);

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
            location: employee.location,
            business_unit: employee.business_unit,
            benefit_class: employee.benefit_class,
            hire_date: employee.hire_date,
            employee_number: employee.employee_number,
            badge_number: employee.badge_number,
            reports_to: employee.reports_to,
            supervisor_name: supervisorName,
            is_hr_admin: employee.is_hr_admin || false
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
      const payload = await verifyJWT(token);
      
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

        const currentValid = await verifyPassword(current_password, employee.badge_pin_hash);
        if (!currentValid) {
          return new Response(
            JSON.stringify({ error: "Current password is incorrect" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(new_password);

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
        .select("id, name_first, name_last, user_email, job_title, department, job_level, location, business_unit, benefit_class, hire_date, employee_number, badge_number, reports_to, is_hr_admin")
        .eq("id", employeeId)
        .single();

      // Lookup supervisor name
      const supervisorName = await getSupervisorName(supabase, updatedEmployee?.reports_to);

      // Issue new full token
      const newToken = await createJWT({
        employee_id: employeeId,
        email: updatedEmployee?.user_email,
        name: `${updatedEmployee?.name_first} ${updatedEmployee?.name_last}`,
        is_hr_admin: updatedEmployee?.is_hr_admin || false
      });

      return new Response(
        JSON.stringify({
          success: true,
          token: newToken,
          employee: {
            ...updatedEmployee,
            supervisor_name: supervisorName
          }
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
      const payload = await verifyJWT(token);

      if (!payload || payload.temp) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch current employee data
      const { data: employee } = await supabase
        .from("employees")
        .select("id, name_first, name_last, user_email, job_title, department, job_level, location, business_unit, benefit_class, hire_date, employee_number, badge_number, reports_to, badge_pin_is_default, is_active, is_hr_admin")
        .eq("id", payload.employee_id as string)
        .single();

      if (!employee || !employee.is_active) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lookup supervisor name
      const supervisorName = await getSupervisorName(supabase, employee.reports_to);

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
            location: employee.location,
            business_unit: employee.business_unit,
            benefit_class: employee.benefit_class,
            hire_date: employee.hire_date,
            employee_number: employee.employee_number,
            badge_number: employee.badge_number,
            reports_to: employee.reports_to,
            supervisor_name: supervisorName,
            is_hr_admin: employee.is_hr_admin || false
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /admin/set-default-passwords - Set default password for all employees
    if (req.method === "POST" && path === "/admin/set-default-passwords") {
      const { admin_key, default_password } = await req.json();

      // Simple admin key check using service role key
      if (admin_key !== SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordToSet = default_password || "Welcome2Bunting!";
      
      if (passwordToSet.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash the default password
      const hashedPassword = await hashPassword(passwordToSet);

      // Update all active employees with email addresses
      const { data: updated, error: updateError } = await supabase
        .from("employees")
        .update({
          badge_pin_hash: hashedPassword,
          badge_pin_is_default: true,
          badge_pin_attempts: 0,
          badge_pin_locked_until: null
        })
        .eq("is_active", true)
        .not("user_email", "is", null)
        .select("id, user_email");

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update passwords" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Default password set for ${updated?.length || 0} employees`,
          employees_updated: updated?.length || 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /admin/reset-employee-password - Reset a specific employee's password
    if (req.method === "POST" && path === "/admin/reset-employee-password") {
      const { admin_key, employee_id, default_password } = await req.json();

      if (admin_key !== SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!employee_id) {
        return new Response(
          JSON.stringify({ error: "Employee ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordToSet = default_password || "Welcome2Bunting!";
      const hashedPassword = await hashPassword(passwordToSet);

      const { error: updateError } = await supabase
        .from("employees")
        .update({
          badge_pin_hash: hashedPassword,
          badge_pin_is_default: true,
          badge_pin_attempts: 0,
          badge_pin_locked_until: null
        })
        .eq("id", employee_id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to reset password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password reset successfully" }),
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
