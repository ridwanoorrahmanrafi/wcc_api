import nodemailer from 'nodemailer';

// Email validation regex helper
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

// In-memory record of sent emails (useful for verification and test assertions)
const sentEmails = [];

export const getSentEmails = () => [...sentEmails];
export const getLastSentEmail = () => (sentEmails.length > 0 ? sentEmails[sentEmails.length - 1] : null);
export const clearSentEmails = () => {
  sentEmails.length = 0;
};

let cachedTransporter = null;

/**
 * Initializes and returns Nodemailer transporter using environment variables.
 * Falls back to in-memory stream transport if SMTP credentials are not configured.
 */
export const getTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
    console.log(`[EmailService] Connected to SMTP server: ${host}:${port}`);
  } else {
    // Development or test environment fallback: stream transporter creates email buffer without external network
    cachedTransporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows',
      buffer: true
    });
    console.log('[EmailService] SMTP credentials not set. Using test stream transport.');
  }

  return cachedTransporter;
};

/**
 * Core safe send function.
 * Ensures email failures NEVER cause parent operations to fail.
 */
export const sendMailSafe = async ({ to, subject, html, text }) => {
  try {
    if (!to || !isValidEmail(to)) {
      console.warn(`[EmailService] Warning: Skipping dispatch, invalid recipient: "${to}"`);
      return { success: false, reason: 'invalid_recipient' };
    }

    const transporter = await getTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"We Can Change (WCC)" <no-reply@wecanchange.org>';

    const mailOptions = {
      from: fromAddress,
      to: to.trim(),
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, '')
    };

    const result = await transporter.sendMail(mailOptions);

    const record = {
      to: to.trim(),
      from: fromAddress,
      subject,
      text: mailOptions.text,
      html: mailOptions.html,
      messageId: result.messageId,
      timestamp: new Date()
    };
    if (sentEmails.length >= 200) {
      sentEmails.shift();
    }
    sentEmails.push(record);

    console.log(`[EmailService] Notification sent to: ${to} | Subject: "${subject}"`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error(`[EmailService Error] Failed to send email to "${to}":`, err.message);
    // Return error object without throwing, preserving main database transaction
    return { success: false, error: err.message };
  }
};

/**
 * 1. Issue Status Change Notification
 * Triggered on pending -> in_progress or in_progress -> resolved
 */
export const sendIssueStatusEmail = async ({
  to,
  reporterName = 'Community Resident',
  issueCode,
  issueTitle,
  status,
  previousStatus
}) => {
  const isResolved = status === 'resolved';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const trackingUrl = `${clientUrl}/report-issue?track=${encodeURIComponent(issueCode)}`;

  const statusLabel = isResolved ? 'Resolved' : 'In Progress';
  const statusColor = isResolved ? '#10B981' : '#F59E0B';
  const shortMessage = isResolved
    ? 'Good news! Your reported community issue has been successfully resolved by our field team and wing coordinators.'
    : 'Your reported community issue has been reviewed and assigned to a coordinator. Field operations are now actively in progress.';

  const subject = `[WCC] Issue Update: ${issueCode} is now ${statusLabel}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
        .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .logo { font-size: 20px; font-weight: 900; color: #B62A35; letter-spacing: -0.5px; margin-bottom: 24px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; background-color: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}40; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0; }
        p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
        .details-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .detail-label { color: #64748B; font-weight: 600; }
        .detail-value { color: #0F172A; font-weight: 700; }
        .btn { display: inline-block; background-color: #B62A35; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; margin-top: 8px; }
        .footer { font-size: 11px; color: #94A3B8; text-align: center; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">We Can Change (WCC)</div>
        <div class="badge">${statusLabel}</div>
        <h1>Community Issue Status Updated</h1>
        <p>Dear ${reporterName},</p>
        <p>${shortMessage}</p>
        <div class="details-box">
          <div class="detail-row"><span class="detail-label">Tracking Code:</span> <span class="detail-value">${issueCode}</span></div>
          <div class="detail-row"><span class="detail-label">Issue Title:</span> <span class="detail-value">${issueTitle}</span></div>
          <div class="detail-row"><span class="detail-label">Previous Status:</span> <span class="detail-value" style="text-transform: capitalize;">${previousStatus || 'Pending'}</span></div>
          <div class="detail-row"><span class="detail-label">Current Status:</span> <span class="detail-value" style="color: ${statusColor}; text-transform: capitalize;">${statusLabel}</span></div>
        </div>
        <p>You can verify this update on our public tracking portal anytime:</p>
        <a href="${trackingUrl}" class="btn">Track Your Issue Online</a>
        <div class="footer">
          We Can Change — Building a better, cleaner, and healthier community.<br>
          If you did not report this issue, please disregard this email.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
We Can Change (WCC) - Community Issue Update

Dear ${reporterName},

${shortMessage}

Issue Code: ${issueCode}
Issue Title: ${issueTitle}
Previous Status: ${previousStatus || 'Pending'}
Current Status: ${statusLabel}

Track live status here: ${trackingUrl}

We Can Change — Building a better, cleaner, and healthier community.
  `;

  return sendMailSafe({ to, subject, html, text });
};

/**
 * 2. Event Registration Confirmation Notification
 * Triggered after successful event registration
 */
export const sendEventRegistrationEmail = async ({
  to,
  participantName = 'Valued Participant',
  eventTitle,
  eventDate,
  eventLocation
}) => {
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Date to be announced';

  const subject = `[WCC] Registration Confirmed: ${eventTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
        .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .logo { font-size: 20px; font-weight: 900; color: #B62A35; letter-spacing: -0.5px; margin-bottom: 24px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; background-color: #10B98115; color: #10B981; border: 1px solid #10B98140; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0; }
        p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
        .details-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .detail-label { color: #64748B; font-weight: 600; }
        .detail-value { color: #0F172A; font-weight: 700; }
        .footer { font-size: 11px; color: #94A3B8; text-align: center; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">We Can Change (WCC)</div>
        <div class="badge">Seat Confirmed</div>
        <h1>Event Registration Confirmation</h1>
        <p>Dear ${participantName},</p>
        <p>Congratulations! Your seat has been successfully reserved for our upcoming initiative. We are excited to have you participate.</p>
        <div class="details-box">
          <div class="detail-row"><span class="detail-label">Event:</span> <span class="detail-value">${eventTitle}</span></div>
          <div class="detail-row"><span class="detail-label">Date:</span> <span class="detail-value">${formattedDate}</span></div>
          <div class="detail-row"><span class="detail-label">Location:</span> <span class="detail-value">${eventLocation || 'TBA'}</span></div>
          <div class="detail-row"><span class="detail-label">Status:</span> <span class="detail-value" style="color: #10B981;">Confirmed</span></div>
        </div>
        <p>Please arrive at least 15 minutes before the scheduled time. Thank you for actively contributing to our community.</p>
        <div class="footer">
          We Can Change — Volunteer & Member Operations<br>
          If you are unable to attend, please notify the organizers in advance.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
We Can Change (WCC) - Event Registration Confirmation

Dear ${participantName},

Congratulations! Your seat has been successfully reserved for our upcoming initiative.

Event: ${eventTitle}
Date: ${formattedDate}
Location: ${eventLocation || 'TBA'}
Status: Confirmed

Please arrive at least 15 minutes before the scheduled time.

We Can Change — Building a better, cleaner, and healthier community.
  `;

  return sendMailSafe({ to, subject, html, text });
};

/**
 * 3. Member Approval/Rejection Notification
 * Triggered on member approval or rejection
 */
export const sendMemberApprovalEmail = async ({
  to,
  memberName = 'Member',
  memberId,
  status, // 'Active' / 'approved' / 'Rejected' / 'rejected'
  wing = 'General Wing',
  requestType,
  notes
}) => {
  const isApproved = status.toLowerCase() === 'active' || status.toLowerCase() === 'approved';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const loginUrl = `${clientUrl}/login`;

  const statusLabel = isApproved ? 'Approved' : 'Application Update';
  const statusColor = isApproved ? '#10B981' : '#EF4444';
  const subject = isApproved
    ? `[WCC] Welcome to We Can Change - Membership Approved!`
    : `[WCC] Update regarding your membership application (${memberId})`;

  const message = isApproved
    ? requestType
      ? `Your request (${requestType}) has been approved by the administration.`
      : `Congratulations! Your membership application has been reviewed and officially approved. You are now an active member of We Can Change.`
    : requestType
      ? `Your request (${requestType}) was reviewed and could not be approved at this time.${notes ? ` Note: ${notes}` : ''}`
      : `Thank you for your interest in We Can Change. After reviewing your application, we are unable to accept it at this time.${notes ? ` Note: ${notes}` : ''}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
        .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .logo { font-size: 20px; font-weight: 900; color: #B62A35; letter-spacing: -0.5px; margin-bottom: 24px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; background-color: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}40; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0; }
        p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
        .details-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .detail-label { color: #64748B; font-weight: 600; }
        .detail-value { color: #0F172A; font-weight: 700; }
        .btn { display: inline-block; background-color: #B62A35; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; margin-top: 8px; }
        .footer { font-size: 11px; color: #94A3B8; text-align: center; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">We Can Change (WCC)</div>
        <div class="badge">${statusLabel}</div>
        <h1>${isApproved ? 'Membership Status: Active' : 'Application Status Update'}</h1>
        <p>Dear ${memberName},</p>
        <p>${message}</p>
        <div class="details-box">
          <div class="detail-row"><span class="detail-label">Member ID:</span> <span class="detail-value">${memberId}</span></div>
          <div class="detail-row"><span class="detail-label">Assigned Wing:</span> <span class="detail-value">${wing}</span></div>
          <div class="detail-row"><span class="detail-label">Membership Status:</span> <span class="detail-value" style="color: ${statusColor};">${isApproved ? 'Active & Verified' : 'Rejected'}</span></div>
        </div>
        ${isApproved ? `<p>You can sign in to your dashboard to view your official digital ID card and participate in drives:</p><a href="${loginUrl}" class="btn">Sign In to Member Portal</a>` : ''}
        <div class="footer">
          We Can Change — Registry & Membership Directorate<br>
          Questions? Contact our team at support@wecanchange.org
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
We Can Change (WCC) - Membership Application Update

Dear ${memberName},

${message}

Member ID: ${memberId}
Assigned Wing: ${wing}
Status: ${isApproved ? 'Active' : 'Rejected'}

${isApproved ? `Access your portal: ${loginUrl}` : ''}

We Can Change — Building a better, cleaner, and healthier community.
  `;

  return sendMailSafe({ to, subject, html, text });
};

/**
 * 4. Password Reset Notification
 * Triggered on user requesting forgot-password
 */
export const sendPasswordResetEmail = async ({
  to,
  name = 'Valued Member',
  resetToken,
  resetUrl
}) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const finalResetUrl = resetUrl || `${clientUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const subject = '[WCC] Password Reset Request';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
        .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .logo { font-size: 20px; font-weight: 900; color: #B62A35; letter-spacing: -0.5px; margin-bottom: 24px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; text-transform: uppercase; background-color: #EF444415; color: #EF4444; border: 1px solid #EF444440; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0; }
        p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
        .details-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #64748B; }
        .btn { display: inline-block; background-color: #B62A35; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; margin: 12px 0; }
        .url-box { font-family: monospace; font-size: 12px; background: #EEF2F6; padding: 10px; border-radius: 8px; word-break: break-all; color: #334155; margin-top: 8px; }
        .footer { font-size: 11px; color: #94A3B8; text-align: center; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">We Can Change (WCC)</div>
        <div class="badge">Security Notice</div>
        <h1>Password Reset Request</h1>
        <p>Dear ${name},</p>
        <p>We received a request to reset the password for your We Can Change (WCC) account. To choose a new password, click the button below:</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${finalResetUrl}" class="btn">Reset My Password</a>
        </div>

        <div class="details-box">
          <strong>Important Security Information:</strong><br>
          • This link is valid for <strong>1 hour</strong> only.<br>
          • If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized access.<br>
          • Your current password will remain active until you submit a new one.
        </div>

        <p style="font-size: 12px; color: #64748B;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <div class="url-box">${finalResetUrl}</div>

        <div class="footer">
          We Can Change — Information Technology & Cyber Security Directorate<br>
          This is an automated security transmission. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
We Can Change (WCC) - Password Reset Request

Dear ${name},

We received a request to reset the password for your We Can Change (WCC) account.

To reset your password, visit the link below (valid for 1 hour):
${finalResetUrl}

If you did not request a password reset, you can safely ignore this email.

We Can Change — Building a better, cleaner, and healthier community.
  `;

  return sendMailSafe({ to, subject, html, text });
};

