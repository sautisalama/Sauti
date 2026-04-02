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
