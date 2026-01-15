import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("PEP_JWT_SECRET") || "bunting-pep-jwt-secret-2025";

// Verify custom JWT token
async function verifyJWT(token: string): Promise<{ valid: boolean; payload?: any }> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return { valid: false };
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(signatureInput)
    );

    if (!isValid) {
      return { valid: false };
    }

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { valid: false };
    }

    return { valid: true, payload };
  } catch (error) {
    console.error("[team-hierarchy] JWT verification error:", error);
    return { valid: false };
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Get and verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { valid, payload } = await verifyJWT(token);

    if (!valid || !payload?.employee_id) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const employeeId = payload.employee_id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Handle different endpoints
    if (path === "check-subordinates") {
      // Check if user has any direct reports
      const { count, error } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("reports_to", employeeId)
        .eq("benefit_class", "salary")
        .eq("is_active", true);

      if (error) {
        console.error("[team-hierarchy] Error checking subordinates:", error);
        return new Response(
          JSON.stringify({ error: "Failed to check subordinates" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ hasSubordinates: (count || 0) > 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (path === "hierarchy") {
      const year = parseInt(url.searchParams.get("year") || "2025");

      // Fetch all active salaried employees
      const { data: allEmployees, error: empError } = await supabase
        .from("employees")
        .select("id, name_first, name_last, job_title, department, user_email, reports_to")
        .eq("is_active", true)
        .eq("benefit_class", "salary");

      if (empError) {
        console.error("[team-hierarchy] Error fetching employees:", empError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch employees" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!allEmployees || allEmployees.length === 0) {
        return new Response(
          JSON.stringify({ hierarchy: [], stats: { total: 0, submitted: 0, inProgress: 0, notStarted: 0 } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build a set of all subordinate IDs (recursive)
      const subordinateIds = new Set<string>();
      const findSubordinates = (managerId: string) => {
        allEmployees.forEach(emp => {
          if (emp.reports_to === managerId && !subordinateIds.has(emp.id)) {
            subordinateIds.add(emp.id);
            findSubordinates(emp.id);
          }
        });
      };
      findSubordinates(employeeId);

      if (subordinateIds.size === 0) {
        return new Response(
          JSON.stringify({ hierarchy: [], stats: { total: 0, submitted: 0, inProgress: 0, notStarted: 0 } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get evaluations for all subordinates
      const { data: evaluations, error: evalError } = await supabase
        .from("pep_evaluations")
        .select("employee_id, status, submitted_at, pdf_url")
        .in("employee_id", Array.from(subordinateIds))
        .eq("period_year", year);

      if (evalError) {
        console.error("[team-hierarchy] Error fetching evaluations:", evalError);
      }

      const evalMap = new Map(
        evaluations?.map(e => [e.employee_id, e]) || []
      );

      // Build flat list with evaluation data
      const flatList = allEmployees
        .filter(emp => subordinateIds.has(emp.id))
        .map(emp => {
          const eval_ = evalMap.get(emp.id);
          return {
            id: emp.id,
            name: `${emp.name_first} ${emp.name_last}`,
            job_title: emp.job_title,
            department: emp.department,
            evaluation_status: eval_?.status || "not_started",
            submitted_at: eval_?.submitted_at || null,
            pdf_url: eval_?.pdf_url || null,
            email: emp.user_email || null,
            reports_to: emp.reports_to,
          };
        });

      // Build hierarchy tree
      const nodeMap = new Map<string, any>();
      flatList.forEach(item => {
        nodeMap.set(item.id, { ...item, children: [] });
      });

      const rootNodes: any[] = [];
      flatList.forEach(item => {
        const node = nodeMap.get(item.id);
        if (item.reports_to === employeeId) {
          rootNodes.push(node);
        } else if (nodeMap.has(item.reports_to!)) {
          nodeMap.get(item.reports_to!)?.children.push(node);
        }
      });

      // Calculate stats
      let submitted = 0, inProgress = 0, notStarted = 0;
      flatList.forEach(item => {
        if (item.evaluation_status === "submitted" || item.evaluation_status === "reviewed" || item.evaluation_status === "signed") {
          submitted++;
        } else if (item.evaluation_status === "draft" || item.evaluation_status === "reopened") {
          inProgress++;
        } else {
          notStarted++;
        }
      });

      return new Response(
        JSON.stringify({
          hierarchy: rootNodes,
          stats: { total: flatList.length, submitted, inProgress, notStarted }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown endpoint" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[team-hierarchy] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
