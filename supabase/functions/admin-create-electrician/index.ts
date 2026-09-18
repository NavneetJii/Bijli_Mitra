import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's own session (as themselves, using the anon key +
    // their token -- this respects RLS and just tells us who they are).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid authentication session." }, 401);

    // Admin client (service role) -- used both to verify the caller is
    // actually an admin (bypassing RLS to check their own profile row is
    // safe here since we already know their real user id from their own
    // verified token above) and to create the new electrician account.
    const admin = createClient(supabaseUrl, serviceRole);

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "admin") {
      return json({ error: "Only admins can create electrician accounts." }, 403);
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const fullName = String(body?.full_name || "").trim();
    const phone = String(body?.phone || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "A valid email is required." }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }
    if (!fullName) {
      return json({ error: "Full name is required." }, 400);
    }
    if (!phone) {
      return json({ error: "Phone number is required." }, 400);
    }

    // Creating the auth user this way (Admin API, service role only -- this
    // key is NEVER exposed to the browser) fires the same handle_new_user
    // database trigger that runs on normal signup. Passing role:
    // 'electrician' in user_metadata makes that trigger create both the
    // profiles row AND the matching electrician_profiles row automatically
    // -- no separate insert needed here.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, role: "electrician" },
    });

    if (createError || !created?.user) {
      return json({ error: createError?.message || "Failed to create electrician account." }, 400);
    }

    return json({
      id: created.user.id,
      email: created.user.email,
      full_name: fullName,
      phone,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});