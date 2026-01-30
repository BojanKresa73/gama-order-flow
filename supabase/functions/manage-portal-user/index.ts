import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller has admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!roleData || !["superuser", "admin", "admin_plus"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Nemate dozvolu za ovu akciju" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, portalUserId, userId, fullName, phone, email, password } = body;

    console.log(`Managing portal user: action=${action}, portalUserId=${portalUserId}`);

    if (action === "update") {
      // Update profile in client_portal_users
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (fullName) updates.full_name = fullName;
      if (phone !== undefined) updates.phone = phone || null;

      const { error: profileError } = await supabaseAdmin
        .from("client_portal_users")
        .update(updates)
        .eq("id", portalUserId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        return new Response(
          JSON.stringify({ error: "Greška pri ažuriranju profila: " + profileError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update email if provided
      if (email && userId) {
        const emailClean = String(email).trim();
        if (!emailClean) {
          // Empty after trimming, skip
        } else {
        // First check if email is already the same
        const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (existingUser?.user?.email?.toLowerCase() === emailClean.toLowerCase()) {
          console.log("Email is the same, skipping update");
          // Email is the same, no need to update - just continue
        } else {
          const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: emailClean,
          });

          if (emailError) {
            console.error("Email update error:", emailError);
            // Check if it's a validation error
            if (emailError.message?.includes("invalid format") || emailError.message?.includes("validate email")) {
              return new Response(
                JSON.stringify({ error: "Email format nije prihvaćen od sistema. Proverite da li je email ispravan ili kontaktirajte podršku." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            return new Response(
              JSON.stringify({ error: "Greška pri promeni emaila: " + emailError.message }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        }
      }

      // Update password if provided
      if (password && userId) {
        if (password.length < 6) {
          return new Response(
            JSON.stringify({ error: "Lozinka mora imati najmanje 6 karaktera" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: password,
        });

        if (passwordError) {
          console.error("Password update error:", passwordError);
          return new Response(
            JSON.stringify({ error: "Greška pri promeni lozinke: " + passwordError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!userId || !portalUserId) {
        return new Response(
          JSON.stringify({ error: "Nedostaju podaci za brisanje" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete from client_portal_users first
      const { error: deletePortalError } = await supabaseAdmin
        .from("client_portal_users")
        .delete()
        .eq("id", portalUserId);

      if (deletePortalError) {
        console.error("Portal user delete error:", deletePortalError);
        return new Response(
          JSON.stringify({ error: "Greška pri brisanju: " + deletePortalError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete auth user
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteAuthError) {
        console.error("Auth user delete error:", deleteAuthError);
        // Non-critical - portal user is already deleted
        console.log("Auth user deletion failed but portal user was deleted");
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Nepoznata akcija" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
