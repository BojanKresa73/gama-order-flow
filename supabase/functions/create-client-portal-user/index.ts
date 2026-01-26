import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreatePortalUserRequest {
  clientId: string;
  email: string;
  fullName: string;
  phone?: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Nedostaje autorizacija" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Nevalidna autorizacija" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!callerRole || !["superuser", "admin_plus", "admin"].includes(callerRole.role)) {
      return new Response(
        JSON.stringify({ error: "Nemate dozvolu za ovu akciju" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientId, email, fullName, phone, password }: CreatePortalUserRequest = await req.json();

    // Validate inputs
    if (!clientId || !email || !fullName || !password) {
      return new Response(
        JSON.stringify({ error: "Sva polja su obavezna" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if client exists
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Klijent nije pronađen" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check current portal user count for this client
    const { count, error: countError } = await supabase
      .from("client_portal_users")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    if (countError) {
      console.error("Error counting portal users:", countError);
    }

    if (count !== null && count >= 2) {
      return new Response(
        JSON.stringify({ error: "Klijent već ima maksimalan broj korisnika portala (2)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const emailExists = existingUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Korisnik sa ovim emailom već postoji" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-client-portal-user] Creating user for client ${client.name}`);

    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      console.error("Error creating auth user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // Create profile
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: fullName,
        is_active: true,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Greška pri kreiranju profila" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign client_user role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "client_user",
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      // Rollback
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Greška pri dodeli uloge" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client portal user entry
    const { error: portalError } = await supabase
      .from("client_portal_users")
      .insert({
        client_id: clientId,
        user_id: userId,
        full_name: fullName,
        phone: phone || null,
      });

    if (portalError) {
      console.error("Error creating portal user entry:", portalError);
      // Rollback
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: portalError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-client-portal-user] Successfully created portal user ${email} for client ${client.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: `Korisnik ${fullName} uspešno kreiran za klijenta ${client.name}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[create-client-portal-user] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
