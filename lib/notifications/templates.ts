/**
 * Serene, trauma-informed email templates for Sauti Salama notifications.
 * Designed to be professional, calm, and clear.
 */

export const getAppointmentScheduledTemplate = (data: {
  userName: string;
  professionalName: string;
  date: string;
  time: string;
  type: string;
  actionUrl: string;
}) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #f1f5f9; }
        .header { background: #0d9488; padding: 40px 20px; text-align: center; color: white; }
        .content { padding: 40px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        .button { display: inline-block; padding: 14px 28px; background-color: #0d9488; color: white !important; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 20px; }
        .details { background: #f0fdfa; border: 1px solid #ccfbf1; padding: 20px; border-radius: 16px; margin: 20px 0; }
        .detail-item { margin-bottom: 10px; font-size: 14px; }
        .detail-label { font-weight: bold; color: #115e59; display: inline-block; width: 100px; }
        h1 { margin: 0; font-size: 24px; letter-spacing: -0.025em; }
        p { margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Sauti Salama</h1>
            <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Secure Support Coordination</p>
        </div>
        <div class="content">
            <p>Hello ${data.userName},</p>
            <p>A new support session has been suggested for your journey. <strong>${data.professionalName}</strong> has proposed a meeting time to coordinate your care.</p>
            
            <div class="details">
                <div class="detail-item"><span class="detail-label">Date:</span> ${data.date}</div>
                <div class="detail-item"><span class="detail-label">Time:</span> ${data.time}</div>
                <div class="detail-item"><span class="detail-label">Format:</span> ${data.type}</div>
            </div>

            <p>Please review this suggestion in your secure hub. You can accept the time or suggest a different slot if this doesn't work for you.</p>
            
            <div style="text-align: center;">
                <a href="${data.actionUrl}" class="button">Review Schedule</a>
            </div>
            
            <p style="margin-top: 40px; font-size: 13px; color: #64748b; font-style: italic;">
                Privacy Note: This email is part of your secure support journey. Always ensure you are in a private space when accessing the Sauti Salama platform.
            </p>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Sauti Salama. All rights reserved.<br>
            Safe, Secure, and Private Support.
        </div>
    </div>
</body>
</html>
`;

export const getAppointmentConfirmedTemplate = (data: {
  userName: string;
  professionalName: string;
  date: string;
  time: string;
  type: string;
  location?: string;
  actionUrl: string;
}) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #f1f5f9; }
        .header { background: #059669; padding: 40px 20px; text-align: center; color: white; }
        .content { padding: 40px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        .button { display: inline-block; padding: 14px 28px; background-color: #059669; color: white !important; text-decoration: none; border-radius: 12px; font-weight: bold; margin-top: 20px; }
        .details { background: #ecfdf5; border: 1px solid #d1fae5; padding: 20px; border-radius: 16px; margin: 20px 0; }
        .detail-item { margin-bottom: 10px; font-size: 14px; }
        .detail-label { font-weight: bold; color: #065f46; display: inline-block; width: 100px; }
        h1 { margin: 0; font-size: 24px; letter-spacing: -0.025em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Session Confirmed</h1>
            <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Your support connection is set</p>
        </div>
        <div class="content">
            <p>Hello ${data.userName},</p>
            <p>Your support session with <strong>${data.professionalName}</strong> has been successfully confirmed. A calendar invitation has also been sent to your linked calendar.</p>
            
            <div class="details">
                <div class="detail-item"><span class="detail-label">Date:</span> ${data.date}</div>
                <div class="detail-item"><span class="detail-label">Time:</span> ${data.time}</div>
                <div class="detail-item"><span class="detail-label">Format:</span> ${data.type}</div>
                ${data.location ? `<div class="detail-item"><span class="detail-label">Link/Loc:</span> ${data.location}</div>` : ''}
            </div>

            <p>Our secure chat is open if you need to share any updates before the meeting.</p>
            
            <div style="text-align: center;">
                <a href="${data.actionUrl}" class="button">Go to Secure Hub</a>
            </div>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Sauti Salama. Partnering in your journey.
        </div>
    </div>
</body>
</html>
`;

export const baseTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #f1f5f9; }
        .header { background: #0d9488; padding: 40px 20px; text-align: center; color: white; }
        .content { padding: 40px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #0d9488; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; }
        h1 { margin: 0; font-size: 24px; letter-spacing: -0.025em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
        </div>
        <div class="content">
            ${content}
            <p style="margin-top: 40px; font-size: 13px; color: #64748b; font-style: italic;">
                Privacy Note: This email is part of your secure support journey. Always ensure you are in a private space when accessing the Sauti Salama platform.
            </p>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Sauti Salama. Safe, Secure, and Private Support.
        </div>
    </div>
</body>
</html>
`;

export const newReportAdminEmail = (
	reportId: string,
	incidentType: string,
	urgency: string,
	requiredServices: string[]
) => baseTemplate(`
    <p>A new abuse report has been submitted that requires administrative review.</p>
    <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 24px; border-radius: 16px; margin: 20px 0;">
        <div style="margin-bottom: 12px; font-size: 14px;"><span style="font-weight: bold; color: #0d9488; width: 100px; display: inline-block;">Report ID:</span> ${reportId}</div>
        <div style="margin-bottom: 12px; font-size: 14px;"><span style="font-weight: bold; color: #0d9488; width: 100px; display: inline-block;">Incident:</span> ${incidentType}</div>
        <div style="margin-bottom: 12px; font-size: 14px;"><span style="font-weight: bold; color: #0d9488; width: 100px; display: inline-block;">Urgency:</span> <span style="color: ${urgency === 'high' ? '#dc2626' : '#92400e'}; font-weight: bold;">${urgency.toUpperCase()}</span></div>
        <div style="margin-bottom: 0; font-size: 14px;"><span style="font-weight: bold; color: #0d9488; width: 100px; display: inline-block;">Services:</span> ${requiredServices.join(", ")}</div>
    </div>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/reports/${reportId}" class="button">View Full Details</a>
    </div>
`, "New Incident Report Received");

export const matchFoundProfessionalEmail = (survivorName: string) => baseTemplate(`
    <p>We have matched you with a new case: <strong>${survivorName}</strong>.</p>
    <p>Please log in to your coordinator dashboard to review the case details and propose a meeting time if you are available to support this individual.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/cases" class="button">View Case Details</a>
    </div>
    <p>Your prompt response helps ensure timely support for survivors in our community.</p>
`, "New Support Case Match");

export const matchFoundSurvivorEmail = (displayName: string, serviceCapability: string) => baseTemplate(`
    <p>Help is on the way. We have matched your report with a verified specialist: <strong>${displayName}</strong>.</p>
    <p>They specialize in <strong>${serviceCapability || 'Support Services'}</strong> and have been notified of your case. You can view their profile and wait for a suggested meeting time in your secure dashboard.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reports" class="button">View My Matches</a>
    </div>
    <p>Remember, you are in control of this journey. You can choose when and how to coordinate with your matched specialists.</p>
`, "Specialist Match Found");

export const welcomeEmail = (userName: string) => baseTemplate(`
    <p>Welcome to Sauti Salama, ${userName}.</p>
    <p>We are glad to have you join our community. Sauti Salama is a secure and private platform designed to support survivors and professionals in their journey toward healing and justice.</p>
    <p>You can now access your secure dashboard to begin coordinating care, reporting incidents, or managing your professional profile.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Go to My Dashboard</a>
    </div>
`, "Welcome to Sauti Salama");

export const profileVerifiedEmail = (name: string) => baseTemplate(`
    <p>Hello ${name},</p>
    <p>We are pleased to inform you that your professional profile has been verified by our administrative team. You are now a verified specialist on Sauti Salama.</p>
    <p>You can now receive case matches and begin supporting survivors through our secure platform.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Access Dashboard</a>
    </div>
`, "Profile Verified");

export const profileRejectedEmail = (name: string, reason: string) => baseTemplate(`
    <p>Hello ${name},</p>
    <p>Thank you for your interest in joining Sauti Salama as a verified specialist. At this time, we are unable to verify your profile for the following reason:</p>
    <div style="background: #fff1f2; border: 1px solid #ffe4e6; padding: 16px; border-radius: 12px; margin: 20px 0; color: #9f1239;">
        <strong>Reason:</strong> ${reason}
    </div>
    <p>You can update your profile information and re-submit for verification at any time.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/profile" class="button">Update Profile</a>
    </div>
`, "Profile Verification Update");

export const serviceVerifiedEmail = (serviceName: string) => baseTemplate(`
    <p>Your service, <strong>${serviceName}</strong>, has been successfully verified and added to the Sauti Salama service directory.</p>
    <p>It is now available for survivors and professionals seeking specialized support in your area of expertise.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/services" class="button">Manage Services</a>
    </div>
`, "Service Verified");

export const serviceRejectedEmail = (serviceName: string, reason: string) => baseTemplate(`
    <p>We have reviewed your service submission for <strong>${serviceName}</strong>. At this time, we cannot include it in our directory.</p>
    <div style="background: #fff1f2; border: 1px solid #ffe4e6; padding: 16px; border-radius: 12px; margin: 20px 0; color: #9f1239;">
        <strong>Feedback:</strong> ${reason}
    </div>
    <p>Please feel free to address these points and re-submit when ready.</p>
`, "Service Verification Update");

export const caseForwardedEmail = (senderName: string) => baseTemplate(`
    <p>A specialist, <strong>${senderName}</strong>, has forwarded a case to you for further coordination or specialized care.</p>
    <p>Please log in to your secure dashboard to review the case details and accept the referral.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/cases" class="button">View Referral</a>
    </div>
`, "Case Forwarded to You");

export const newBlogSubmissionEmail = (title: string, category: string, author: string) => baseTemplate(`
    <p>A new content piece has been submitted for review on Sauti Salama.</p>
    <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 24px; border-radius: 16px; margin: 20px 0;">
        <div style="margin-bottom: 8px;"><strong>Title:</strong> ${title}</div>
        <div style="margin-bottom: 8px;"><strong>Category:</strong> ${category}</div>
        <div style="margin-bottom: 0;"><strong>Author:</strong> ${author}</div>
    </div>
    <p>Please review the submission in the admin console to ensure it aligns with our community guidelines and trauma-informed standards.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/blog" class="button">Review Submission</a>
    </div>
`, "New Content Submission");

export const blogApprovedEmail = (title: string) => baseTemplate(`
    <p>Congratulations! Your article, <strong>"${title}"</strong>, has been approved and is now live on Sauti Salama.</p>
    <p>Thank you for contributing your insights and helping our community grow stronger through shared knowledge.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/blog" class="button">View Your Post</a>
    </div>
`, "Content Approved");

export const blogRejectedEmail = (title: string, reason: string) => baseTemplate(`
    <p>Thank you for your submission, <strong>"${title}"</strong>. Our editorial team has reviewed your work and suggests some modifications before it can be published.</p>
    <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 16px; border-radius: 12px; margin: 20px 0;">
        <strong>Editorial Notes:</strong> ${reason}
    </div>
    <p>You can edit and re-submit your article through your dashboard.</p>
`, "Content Update Requested");

export const newBlogContentEmail = (title: string, type: string) => baseTemplate(`
    <p>New content has been published on Sauti Salama!</p>
    <p>Check out our latest <strong>${type}</strong>: <strong>"${title}"</strong></p>
    <p>Join the conversation and stay informed on our secure platform.</p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/blog" class="button">Read More</a>
    </div>
`, "New Content on Sauti Salama");
