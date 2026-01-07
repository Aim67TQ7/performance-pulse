// @ts-nocheck
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const appId = url.searchParams.get("app_id");
    const includeHistory = url.searchParams.get("include_history") === "true";

    if (!appId) {
      return new Response(
        JSON.stringify({ error: "app_id parameter is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[get-app-version] Fetching version for app_id: ${appId}, include_history: ${includeHistory}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get current version for this app
    const { data: current, error: currentError } = await supabase
      .from("app_revisions")
      .select("version, revision_type, description, release_date")
      .eq("app_id", appId)
      .eq("is_current", true)
      .single();

    if (currentError && currentError.code !== "PGRST116") {
      console.error("[get-app-version] Error fetching current version:", currentError);
      throw currentError;
    }

    let history = null;
    
    // Optionally get full history for this app
    if (includeHistory) {
      const { data: historyData, error: historyError } = await supabase
        .from("app_revisions")
        .select("version, revision_type, description, release_date")
        .eq("app_id", appId)
        .order("major", { ascending: false })
        .order("minor", { ascending: false })
        .order("patch", { ascending: false });

      if (historyError) {
        console.error("[get-app-version] Error fetching history:", historyError);
        throw historyError;
      }
      
      history = historyData;
    }

    console.log(`[get-app-version] Found current version: ${current?.version || 'none'}, history items: ${history?.length || 0}`);

    return new Response(
      JSON.stringify({ current, history }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[get-app-version] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});