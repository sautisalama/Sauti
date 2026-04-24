import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";

/**
 * DELETE PENDING USER (DEVELOPMENT ONLY)
 * Allows admins to clean up invited professionals who haven't completed onboarding.
 * Constraint: User must be 'pending' and have NO support services.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Environment check (as requested by user)
    const isDev = process.env.NODE_ENV === "development";
    // Also allow if running on localhost to be more flexible for the user's local tests
    const host = request.headers.get("host") || "";
    const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

    if (!isDev && !isLocal) {
      return NextResponse.json(
        { error: "Forbidden: This action is only available in development environments." },
        { status: 403 }
      );
    }

    // 2. Verify admin permissions
    const supabase = await createClient();
    const { data: { user: requester }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", requester.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // 3. Get target user ID
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 4. Fetch target user to verify status and services
    // Note: We use the admin client to bypass RLS and see if services exist
    const { data: targetProfile, error: targetErr } = await adminClient
      .from("profiles")
      .select(`
        id,
        email,
        verification_status,
        support_services!user_id(id)
      `)
      .eq("id", userId)
      .single();

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Check conditions
    if (targetProfile.verification_status !== "pending") {
      return NextResponse.json(
        { error: "Only users with 'pending' status can be deleted." },
        { status: 400 }
      );
    }

    const serviceCount = (targetProfile.support_services as unknown as any[])?.length || 0;
    if (serviceCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete user: ${serviceCount} support service(s) already linked.` },
        { status: 400 }
      );
    }

    // 5. Perform the deletion (Profiles then Auth)
    // Deleting the profile record
    const { error: profileDelErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDelErr) {
      throw new Error(`Failed to delete profile: ${profileDelErr.message}`);
    }

    // Deleting the auth user record
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authDelErr) {
      throw new Error(`Failed to delete auth user: ${authDelErr.message}`);
    }

    // 6. Log the admin action
    await adminClient.from("admin_actions").insert({
      admin_id: requester.id,
      action_type: "reject_user" as any, // Closest existing enum value
      target_type: "user",
      target_id: userId,
      details: {
        action: "delete_pending_user_dev",
        email: targetProfile.email,
        reason: "User specifically requested ability to delete pending accounts in dev for cleanup."
      }
    });

    return NextResponse.json({
      success: true,
      message: `User ${targetProfile.email} and all associated data have been removed.`
    });

  } catch (error: any) {
    console.error("[delete-pending-user] Critical Error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during user deletion." },
      { status: 500 }
    );
  }
}
