import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TablesInsert } from "@/types/db-schema";
import { matchReportWithServices } from "@/app/actions/match-services";

export async function POST(request: Request) {
    try {
        const formData = await request.json();
        if (!formData) {
            return new NextResponse(
                JSON.stringify({ error: "Invalid request data" }),
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Transform the data to match the database schema
        const reportData: TablesInsert<"reports"> = {
            first_name: formData.first_name || "Anonymous",
            last_name: formData.last_name || null,
            email: formData.email,
            phone: formData.phone || null,
            type_of_incident: formData.type_of_incident,
            incident_description: formData.incident_description,
            urgency: formData.urgency,
            consent: formData.consent,
            contact_preference: formData.contact_preference,
            required_services: formData.required_services || [],
            latitude: formData.latitude || null,
            longitude: formData.longitude || null,
            submission_timestamp: formData.submission_timestamp,
            ismatched: false,
            match_status: "pending",
            user_id: null,
            media: formData.media || null,
            is_onBehalf: !!formData.is_onBehalf,
            additional_info: formData.additional_info || null
        };

        const { error: supabaseError, data: insertedReport } = await supabase
            .from("reports")
            .insert([reportData])
            .select()
            .single();

        if (supabaseError) throw supabaseError;

        // Match the report with support services
        try {
            await matchReportWithServices(insertedReport.report_id);
        } catch (matchError) {
            console.error("Error matching services:", matchError);
        }

        // Auto-link by phone: if a profile exists with this phone, link the report to that user
        try {
          if (insertedReport.phone) {
            const { data: profile } = await supabase.from('profiles').select('id').eq('phone', insertedReport.phone).single();
            if (profile?.id) {
              await supabase.from('reports').update({ user_id: profile.id }).eq('report_id', insertedReport.report_id);
            }
          }
        } catch (linkErr) {
          console.warn('Anonymous auto-link by phone failed', linkErr);
        }

        return new NextResponse(
            JSON.stringify({ message: "Anonymous report submitted successfully" }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error submitting anonymous report:", error);
        return new NextResponse(
            JSON.stringify({ 
                error: "Failed to submit anonymous report",
                details: error instanceof Error ? error.message : String(error)
            }),
            { status: 500 }
        );
    }
} 