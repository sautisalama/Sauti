
export const styles = {
  container: `
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background-color: #f8fafc;
    color: #334155;
    padding: 40px 20px;
    line-height: 1.6;
  `,
  card: `
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  `,
  header: `
    background-color: #115e59; /* sauti-teal-700 approximation */
    padding: 32px;
    text-align: center;
  `,
  logo: `
    color: #ffffff;
    font-size: 24px;
    font-weight: 700;
    text-decoration: none;
    letter-spacing: -0.5px;
  `,
  content: `
    padding: 40px 32px;
  `,
  title: `
    color: #0f172a;
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 24px;
    letter-spacing: -0.5px;
  `,
  text: `
    color: #475569;
    font-size: 16px;
    margin-bottom: 24px;
  `,
  button: `
    display: inline-block;
    background-color: #14b8a6; /* sauti-teal-500 approximation */
    color: #ffffff;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    margin-top: 8px;
    margin-bottom: 8px;
  `,
  footer: `
    background-color: #f1f5f9;
    padding: 24px;
    text-align: center;
    font-size: 12px;
    color: #94a3b8;
  `,
  link: `
    color: #14b8a6;
    text-decoration: none;
  `,
  divider: `
    border-top: 1px solid #e2e8f0;
    margin: 32px 0;
  `,
  list: `
    list-style-type: none;
    padding: 0;
    margin: 0 0 24px 0;
  `,
  listItem: `
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 15px;
    color: #475569;
  `,
  label: `
    font-weight: 600;
    color: #334155;
    margin-right: 8px;
  `
};

export const baseTemplate = (content: string, title: string = 'Notification from Sauti Salama') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0;">
  <div style="${styles.container}">
    <div style="${styles.card}">
      <div style="${styles.header}">
        <div style="${styles.logo}">Sauti Salama</div>
      </div>
      <div style="${styles.content}">
        ${content}
      </div>
      <div style="${styles.footer}">
        <p>&copy; ${new Date().getFullYear()} Sauti Salama. All rights reserved.</p>
        <p>This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const getButtonHtml = (text: string, url: string) => `
  <div style="text-align: center; margin: 32px 0;">
    <a href="${url}" style="${styles.button}">${text}</a>
  </div>
`;

// --- Specific Templates ---

export const welcomeEmail = (name: string) => {
  const content = `
    <h1 style="${styles.title}">Welcome to Sauti Salama, ${name}</h1>
    <p style="${styles.text}">
      We are honored to have you join our community. Sauti Salama is dedicated to creating a safe, 
      supportive environment for everyone.
    </p>
    <p style="${styles.text}">
      As a member, you now have access to our network of verified professionals and resources.
      We are here to support you every step of the way.
    </p>
    ${getButtonHtml('Explore the Dashboard', process.env.NEXT_PUBLIC_APP_URL + '/dashboard')}
  `;
  return baseTemplate(content, 'Welcome to Sauti Salama');
};

export const profileVerifiedEmail = (name: string) => {
  const content = `
    <h1 style="${styles.title}">You're Verified! 🎉</h1>
    <p style="${styles.text}">
      Great news, ${name}. Your professional profile has been reviewed and verified by our administration team.
    </p>
    <p style="${styles.text}">
      You can now receive case referrals, list your services publicly, and contribute to our community resources.
    </p>
    ${getButtonHtml('View Your Profile', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/profile')}
  `;
  return baseTemplate(content, 'Your Profile is Verified');
};

export const profileRejectedEmail = (name: string, reason: string) => {
  const content = `
    <h1 style="${styles.title}">Profile Update Required</h1>
    <p style="${styles.text}">
      Hello ${name}, thank you for submitting your profile. Our team has reviewed your application 
      and requires some additional information or changes before we can verify your account.
    </p>
    <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; color: #be123c; font-weight: 600;">Admin Notes:</p>
      <p style="margin: 8px 0 0 0; color: #881337;">${reason}</p>
    </div>
    <p style="${styles.text}">
      Please verify the information provided and resubmit your profile for review.
    </p>
    ${getButtonHtml('Update Profile', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/profile')}
  `;
  return baseTemplate(content, 'Action Required: Profile Verification');
};

export const serviceVerifiedEmail = (serviceName: string) => {
  const content = `
    <h1 style="${styles.title}">Service Approved</h1>
    <p style="${styles.text}">
      Your service <strong>"${serviceName}"</strong> has been approved and is now visible to survivors searching for support.
    </p>
    ${getButtonHtml('Manage Services', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/profile?section=services')}
  `;
  return baseTemplate(content, 'Service Approved');
};

export const serviceRejectedEmail = (serviceName: string, reason: string) => {
  const content = `
    <h1 style="${styles.title}">Service Review Update</h1>
    <p style="${styles.text}">
      We reviewed your service listing <strong>"${serviceName}"</strong> and need a few changes before it can go live.
    </p>
    <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; color: #be123c; font-weight: 600;">Feedback:</p>
      <p style="margin: 8px 0 0 0; color: #881337;">${reason}</p>
    </div>
    ${getButtonHtml('Edit Service', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/profile?section=services')}
  `;
  return baseTemplate(content, 'Action Required: Service Review');
};

export const matchFoundSurvivorEmail = (professionalName: string, serviceType: string) => {
  const content = `
    <h1 style="${styles.title}">Match Found</h1>
    <p style="${styles.text}">
      We have matched you with a verified professional, <strong>${professionalName}</strong>, 
      who specializes in <strong>${serviceType}</strong>.
    </p>
    <p style="${styles.text}">
      They have been notified of your case and will review the details securely. 
      You can view the match details in your dashboard.
    </p>
    ${getButtonHtml('View Match Details', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/cases')}
  `;
  return baseTemplate(content, 'New Match Found');
};

export const matchFoundProfessionalEmail = (serviceType: string) => {
  const content = `
    <h1 style="${styles.title}">New Case Assignment</h1>
    <p style="${styles.text}">
      You have been matched with a new case requiring <strong>${serviceType}</strong> services.
    </p>
    <p style="${styles.text}">
      Please review the case details in your secure dashboard as soon as possible.
    </p>
    ${getButtonHtml('Review Case', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/cases')}
  `;
  return baseTemplate(content, 'New Case Referral');
};

export const reportSubmittedEmail = (reportId: string, urgency: string) => {
  const content = `
    <h1 style="${styles.title}">Report Received</h1>
    <p style="${styles.text}">
      We have securely received your report (ID: #${reportId.slice(0, 8)}).
    </p>
    <p style="${styles.text}">
      Our system is processing it with <strong>${urgency}</strong> priority. 
      We will notify you immediately when a professional has been assigned to your case.
    </p>
    ${getButtonHtml('View Report Status', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/reports')}
  `;
  return baseTemplate(content, 'Report Received');
};

export const newReportAdminEmail = (reportId: string, type: string, urgency: string, requiredServices: string[]) => {
  const content = `
    <h1 style="${styles.title}">New Abuse Report</h1>
    <ul style="${styles.list}">
      <li style="${styles.listItem}"><span style="${styles.label}">Report ID:</span> #${reportId}</li>
      <li style="${styles.listItem}"><span style="${styles.label}">Type:</span> ${type}</li>
      <li style="${styles.listItem}"><span style="${styles.label}">Urgency:</span> ${urgency}</li>
      <li style="${styles.listItem}"><span style="${styles.label}">Required Services:</span> ${requiredServices.join(', ')}</li>
    </ul>
    ${getButtonHtml('Open Admin Console', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/admin/reports')}
  `;
  return baseTemplate(content, `New Report: ${type} (${urgency})`);
};

export const caseForwardedEmail = (senderName: string) => {
  const content = `
    <h1 style="${styles.title}">Case Forwarded</h1>
    <p style="${styles.text}">
      Professional <strong>${senderName}</strong> has forwarded a case to you for review.
    </p>
    ${getButtonHtml('View Case', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/cases')}
  `;
  return baseTemplate(content, 'Case Forwarded to You');
};

export const newBlogSubmissionEmail = (title: string, category: string, authorName: string) => {
  const content = `
    <h1 style="${styles.title}">New Content Submission</h1>
    <p style="${styles.text}">
      <strong>${authorName}</strong> has submitted a new blog/event for review.
    </p>
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${title}</p>
      <p style="margin: 0;"><strong>Category:</strong> ${category}</p>
    </div>
    ${getButtonHtml('Review Submission', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/admin/blogs')}
  `;
  return baseTemplate(content, 'New Content Pending Review');
};

export const blogApprovedEmail = (title: string) => {
  const content = `
    <h1 style="${styles.title}">Your Content is Live! 🚀</h1>
    <p style="${styles.text}">
      Your post <strong>"${title}"</strong> has been approved by our team and is now published on the platform.
    </p>
    <p style="${styles.text}">
      It is now visible to the entire community. Thank you for contributing!
    </p>
    ${getButtonHtml('View Post', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/resources')}
  `;
  return baseTemplate(content, 'Content Published');
};

export const blogRejectedEmail = (title: string, reason: string) => {
  const content = `
    <h1 style="${styles.title}">Content Returned for Edit</h1>
    <p style="${styles.text}">
      Your post <strong>"${title}"</strong> needs a few tweaks before we can publish it.
    </p>
    <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; color: #be123c; font-weight: 600;">Editor Notes:</p>
      <p style="margin: 8px 0 0 0; color: #881337;">${reason}</p>
    </div>
    ${getButtonHtml('Edit Submission', process.env.NEXT_PUBLIC_APP_URL + '/dashboard/blogs')}
  `;
  return baseTemplate(content, 'Action Required: Content Review');
};

export const newBlogContentEmail = (title: string, type: string) => {
  const content = `
    <h1 style="${styles.title}">New ${type.charAt(0).toUpperCase() + type.slice(1)} Published</h1>
    <p style="${styles.text}">
      A new ${type} has been published: <strong>${title}</strong>.
    </p>
    ${getButtonHtml('Read Now', process.env.NEXT_PUBLIC_APP_URL + '/blog')}
  `;
  return baseTemplate(content, 'New Content Available');
};
