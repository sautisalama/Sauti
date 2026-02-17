
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications/email';
import * as templates from '@/lib/notifications/templates';

const DEFAULT_EMAIL = 'oliverwai9na@gmail.com'; 

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const type = body.type;
        const email = body.email || DEFAULT_EMAIL;
        
        let html = '';
        let subject = '';

        switch (type) {
            case 'welcome':
                html = templates.welcomeEmail("Test User");
                subject = "Welcome to Sauti Salama";
                break;
            case 'match_found_survivor':
                html = templates.matchFoundSurvivorEmail("Test Professional", "Trauma Counseling");
                subject = "Match Found: Test Professional";
                break;
            case 'match_found_professional':
                html = templates.matchFoundProfessionalEmail("Test Survivor");
                subject = "New Referral: Test Survivor";
                break;
            case 'profile_verified':
                html = templates.profileVerifiedEmail("Test Professional");
                subject = "Profile Verified";
                break;
            case 'profile_rejected':
                html = templates.profileRejectedEmail("Test Professional", "Incomplete documentation");
                subject = "Action Required: Profile Verification";
                break;
            case 'service_verified':
                html = templates.serviceVerifiedEmail("Test Service Name");
                subject = "Service Verified";
                break;
            case 'service_rejected':
                html = templates.serviceRejectedEmail("Test Service Name", "Service mismatched with platform goals");
                subject = "Action Required: Service Verification";
                break;
            case 'case_forwarded':
                html = templates.caseForwardedEmail("Dr. Test Sender");
                subject = "Case Forwarded to You";
                break;
            case 'new_blog_submission':
                html = templates.newBlogSubmissionEmail("Optimizing Recovery Strategies", "Mental Health", "Dr. Author");
                subject = "New Content Submission Pending Review";
                break;
            case 'blog_approved':
                html = templates.blogApprovedEmail("Optimizing Recovery Strategies");
                subject = "Your Content is Live!";
                break;
            case 'blog_rejected':
                html = templates.blogRejectedEmail("My First Post", "Add more citations please.");
                subject = "Content Returned for Edit";
                break;
            case 'new_blog_content':
                html = templates.newBlogContentEmail("Community Event: Annual Gathering", "event");
                subject = "New Content Available";
                break;
            case 'new_report':
                html = templates.newReportAdminEmail("TEST-REPORT-123", "Domestic Violence", "High", ["Legal Aid", "Shelter"]);
                subject = "New Abuse Report: Domestic Violence (High)";
                break;
            default:
                return NextResponse.json({ error: "Invalid type. Available types: welcome, match_found_survivor, match_found_professional, profile_verified, profile_rejected, service_verified, service_rejected, case_forwarded, new_blog_submission, blog_approved, blog_rejected, new_blog_content, new_report" }, { status: 400 });
        }

        await sendEmail(email, subject, html);
        return NextResponse.json({ success: true, message: `Sent '${type}' to ${email}` });

    } catch (error: any) {
        console.error("Test Notification Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
