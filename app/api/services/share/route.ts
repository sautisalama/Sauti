import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const { 
        data: { user },
        error: authError 
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { serviceId, toUserId } = await request.json();

    if (!serviceId || !toUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (user.id === toUserId) {
        return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    // 1. Verify ownership
    const { data: service, error: serviceError } = await supabase
      .from("support_services")
      .select("id, name")
      .eq("id", serviceId)
      .eq("user_id", user.id)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found or unauthorized" }, { status: 404 });
    }

    // 2. Check existing share
    const { data: existingShare } = await supabase
      .from("service_shares")
      .select("id")
      .eq("service_id", serviceId)
      .eq("to_user_id", toUserId)
      .single();

    if (existingShare) {
      return NextResponse.json({ error: "Already shared with this user" }, { status: 400 });
    }

    // 3. Create Share Record
    const { error: shareError } = await supabase
      .from("service_shares")
      .insert({
        service_id: serviceId,
        from_user_id: user.id,
        to_user_id: toUserId,
        status: "pending"
      });

    if (shareError) {
        console.error("Share error:", shareError);
        return NextResponse.json({ error: "Failed to create share record" }, { status: 500 });
    }

    // 4. Create Notification
    // Fetch sender profile for nice name
    const { data: senderProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
    
    const senderName = senderProfile ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() : "A colleague";

    await supabase
      .from("notifications")
      .insert({
        user_id: toUserId,
        type: "service_share_invite",
        title: "New Service Invitation",
        message: `${senderName} has invited you to manage ${service.name}.`,
        metadata: { serviceId: service.id, serviceName: service.name },
        link: "/dashboard/services" // Adjust as needed
      });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
