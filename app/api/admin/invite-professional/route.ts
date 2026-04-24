import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the requesting user is an authenticated admin
    const supabase = await createClient();
    const {
      data: { user: requestingUser },
    } = await supabase.auth.getUser();

    if (!requestingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: requestingProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", requestingUser.id)
      .single();

    if (!requestingProfile?.is_admin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      userType, // "professional" | "ngo"
      professionalTitle,
      serviceName,
    } = body;

    if (!email || !firstName || !lastName || !userType) {
      return NextResponse.json(
        { error: "Missing required fields: email, firstName, lastName, userType" },
        { status: 400 }
      );
    }

    if (!["professional", "ngo"].includes(userType)) {
      return NextResponse.json(
        { error: "userType must be 'professional' or 'ngo'" },
        { status: 400 }
      );
    }

    // 3. Prevent adding users who already have accounts
    const adminClient = createAdminClient();
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: "A user with this email address already has an account on Sauti Salama." },
        { status: 400 }
      );
    }

    // 4. Build the redirect URL for the password setup page
    const headersList = await headers();
    const forwardedHost = headersList.get("x-forwarded-host");
    const hostHeader = headersList.get("host");
    const host = forwardedHost || hostHeader;
    const protocol =
      host?.includes("localhost") || host?.includes("192.168")
        ? "http"
        : "https";
    const appUrl = host
      ? `${protocol}://${host}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Direct redirect to the password setup page — Supabase already handles verification
    // when you click the email link and we just need the user to land on this page
    // with their session established.
    const redirectTo = `${appUrl}/auth/setup-password`;

    // 5. Send the invite via Supabase Auth (service role)
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          invited_by_admin: true,
        },
      });

    if (inviteError) {
      console.error("[invite-professional] Invite error:", inviteError);
      // Provide a user-friendly message for already-registered emails
      const message =
        inviteError.message?.includes("already been registered") ||
        inviteError.message?.includes("already exists")
          ? "A user with this email address already exists in the system."
          : `Failed to send invite: ${inviteError.message}`;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const newUserId = inviteData?.user?.id;
    if (!newUserId) {
      return NextResponse.json(
        { error: "Invite succeeded but no user ID returned." },
        { status: 500 }
      );
    }

    // 5. Upsert the profile with pre-filled data so OnboardingFlow picks it up
    const now = new Date().toISOString();
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          email,
          first_name: firstName,
          last_name: lastName,
          user_type: userType as "professional" | "ngo",
          professional_title: professionalTitle || null,
          onboarded_by_admin: true,
          verification_status: "pending",
          // Store the invited service name in settings for the onboarding hint
          settings: {
            device_tracking_enabled: false,
            login_alerts_enabled: true,
            public_profile: true,
            email_notifications: true,
            push_notifications: true,
            admin_invite_data: {
              service_name: serviceName || null,
              invited_by: requestingUser.id,
              invited_at: now,
            },
          },
          accreditation_files_metadata: "[]",
          profile_image_metadata: "{}",
          created_at: now,
          updated_at: now,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("[invite-professional] Profile upsert error:", profileError);
      // Don't fail the whole request — the invite was sent successfully
      // The profile will be created on first login if it fails here
    }

    // 6. Log the admin action (best-effort — don't fail if enum is not extended yet)
    try {
      await supabase.from("admin_actions").insert({
        admin_id: requestingUser.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action_type: "verify_user" as any, // closest existing enum value; extend DB enum to add invite_professional
        target_type: "user",
        target_id: newUserId,
        details: {
          action: "invite_professional",
          email,
          user_type: userType,
          professional_title: professionalTitle || null,
          service_name: serviceName || null,
        },
      });
    } catch (logErr) {
      console.warn("[invite-professional] Could not log admin action:", logErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Invitation sent to ${email}. They will receive an email to set up their account.`,
        userId: newUserId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[invite-professional] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
