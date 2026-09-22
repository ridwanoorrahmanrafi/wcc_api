import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
};

export const sendIssueStatusEmail = async (issue, status) => {
  if (!issue?.reporterContact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issue.reporterContact)) return;
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[Email] SMTP is not configured; issue notification skipped.');
    return;
  }
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: issue.reporterContact,
    subject: `WCC issue ${issue.issueCode} update`,
    text: `Your issue ${issue.issueCode} (${issue.title}) is now ${status}. Track it at ${process.env.PUBLIC_WEB_URL || 'http://localhost:3000/track-issue'}.`
  });
};

export const sendEventRegistrationEmail = async (event, user) => {
  if (!user?.email) return;
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[Email] SMTP is not configured; event confirmation skipped.');
    return;
  }
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: `WCC event registration confirmed: ${event.title}`,
    text: `You are registered for ${event.title} on ${new Date(event.date).toLocaleString()} at ${event.location}.`
  });
};

export const sendMemberRequestDecisionEmail = async (request, status) => {
  if (!request?.memberEmail) return;
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[Email] SMTP is not configured; member request notification skipped.');
    return;
  }
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: request.memberEmail,
    subject: `WCC membership request ${status}`,
    text: `Your ${request.type || 'membership'} request has been ${status}.`
  });
};