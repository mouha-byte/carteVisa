import { supabasePatch, supabasePost } from "@/lib/server/supabase-rest";

type EmailEventRow = {
  id: string;
};

type DispatchTransactionalEmailInput = {
  eventType: string;
  recipientEmail: string | null;
  subject: string;
  html: string;
  text: string;
  payload: Record<string, unknown>;
};

type ApplicationEmailInput = {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string | null;
  companyEmail: string | null;
  jobTitle: string;
};

type ContactAdminNotificationInput = {
  contactMessageId: string;
  fullName: string;
  email: string;
  phone: string | null;
  message: string;
};

type SiteRequestAdminNotificationInput = {
  siteRequestId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  sector: string | null;
  needs: string;
};

function isLikelyEmail(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAdminNotificationEmail(): string | null {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL ??
    process.env.RESEND_REPLY_TO_EMAIL ??
    process.env.RESEND_FROM_EMAIL ??
    null
  );
}

function getResendConfig(): {
  apiKey: string;
  fromEmail: string;
  replyToEmail: string | null;
} {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const replyToEmail = process.env.RESEND_REPLY_TO_EMAIL ?? null;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!fromEmail) {
    throw new Error("Missing RESEND_FROM_EMAIL.");
  }

  return {
    apiKey,
    fromEmail,
    replyToEmail,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown email error.";
}

function parseResendError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string };
    if (typeof parsed.message === "string" && parsed.message) {
      return parsed.message;
    }
    if (typeof parsed.error === "string" && parsed.error) {
      return parsed.error;
    }
  } catch {
    // Keep raw text fallback.
  }

  return raw || "Failed to send email via Resend.";
}

async function queueEmailEvent(
  eventType: string,
  recipientEmail: string,
  payload: Record<string, unknown>
): Promise<string | null> {
  try {
    const result = await supabasePost<EmailEventRow[]>("email_events?select=id", {
      event_type: eventType,
      recipient_email: recipientEmail,
      status: "queued",
      payload,
    });

    return result.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function updateEmailEvent(
  emailEventId: string,
  updateData: Record<string, unknown>
): Promise<void> {
  try {
    await supabasePatch<null>(`email_events?id=eq.${emailEventId}`, updateData, {
      prefer: "return=minimal",
    });
  } catch {
    // Email event update is best effort and should not break app flow.
  }
}

async function sendViaResend(input: {
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string | null> {
  const { apiKey, fromEmail, replyToEmail } = getResendConfig();

  const body: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    reply_to?: string[];
  } = {
    from: fromEmail,
    to: [input.recipientEmail],
    subject: input.subject,
    html: input.html,
    text: input.text,
  };

  if (replyToEmail) {
    body.reply_to = [replyToEmail];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(parseResendError(raw));
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { id?: string };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

export async function dispatchTransactionalEmail(
  input: DispatchTransactionalEmailInput
): Promise<void> {
  if (!isLikelyEmail(input.recipientEmail)) {
    return;
  }

  const emailEventId = await queueEmailEvent(
    input.eventType,
    input.recipientEmail,
    input.payload
  );

  try {
    const providerMessageId = await sendViaResend({
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (emailEventId) {
      await updateEmailEvent(emailEventId, {
        status: "sent",
        provider_message_id: providerMessageId,
        error_message: null,
      });
    }
  } catch (error) {
    if (emailEventId) {
      await updateEmailEvent(emailEventId, {
        status: "failed",
        provider_message_id: null,
        error_message: getErrorMessage(error),
      });
    }
  }
}

export async function sendApplicationEmails(
  input: ApplicationEmailInput
): Promise<void> {
  const jobTitle = input.jobTitle || "Job opportunity";

  await Promise.all([
    dispatchTransactionalEmail({
      eventType: "application_candidate_confirmation",
      recipientEmail: input.candidateEmail,
      subject: `Application received - ${jobTitle}`,
      html: `<p>Hello ${input.candidateName},</p><p>Your application for <strong>${jobTitle}</strong> has been received.</p><p>Application ID: ${input.applicationId}</p>`,
      text:
        `Hello ${input.candidateName}, your application for ${jobTitle} has been received. ` +
        `Application ID: ${input.applicationId}.`,
      payload: {
        application_id: input.applicationId,
        job_title: jobTitle,
        audience: "candidate",
      },
    }),
    dispatchTransactionalEmail({
      eventType: "application_company_notification",
      recipientEmail: input.companyEmail,
      subject: `New application - ${jobTitle}`,
      html:
        `<p>Hello ${input.companyName ?? "Team"},</p>` +
        `<p>A new candidate has applied for <strong>${jobTitle}</strong>.</p>` +
        `<p>Candidate: ${input.candidateName} (${input.candidateEmail})</p>` +
        `<p>Application ID: ${input.applicationId}</p>`,
      text:
        `A new candidate has applied for ${jobTitle}. ` +
        `Candidate: ${input.candidateName} (${input.candidateEmail}). ` +
        `Application ID: ${input.applicationId}.`,
      payload: {
        application_id: input.applicationId,
        job_title: jobTitle,
        audience: "company",
      },
    }),
  ]);
}

export async function sendContactAdminNotification(
  input: ContactAdminNotificationInput
): Promise<void> {
  const recipientEmail = getAdminNotificationEmail();

  await dispatchTransactionalEmail({
    eventType: "contact_admin_notification",
    recipientEmail,
    subject: `New contact message - ${input.fullName}`,
    html:
      `<p>Hello Admin,</p>` +
      `<p>A new contact message was submitted.</p>` +
      `<p><strong>Contact ID:</strong> ${escapeHtml(input.contactMessageId)}</p>` +
      `<p><strong>Name:</strong> ${escapeHtml(input.fullName)}</p>` +
      `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>` +
      `<p><strong>Phone:</strong> ${escapeHtml(input.phone ?? "N/A")}</p>` +
      `<p><strong>Message:</strong><br/>${escapeHtml(input.message)}</p>`,
    text:
      `New contact message submitted. ` +
      `Contact ID: ${input.contactMessageId}. ` +
      `Name: ${input.fullName}. ` +
      `Email: ${input.email}. ` +
      `Phone: ${input.phone ?? "N/A"}. ` +
      `Message: ${input.message}`,
    payload: {
      contact_message_id: input.contactMessageId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      audience: "admin",
    },
  });
}

export async function sendSiteRequestAdminNotification(
  input: SiteRequestAdminNotificationInput
): Promise<void> {
  const recipientEmail = getAdminNotificationEmail();

  await dispatchTransactionalEmail({
    eventType: "site_request_admin_notification",
    recipientEmail,
    subject: `New site request - ${input.companyName}`,
    html:
      `<p>Hello Admin,</p>` +
      `<p>A new website creation request was submitted.</p>` +
      `<p><strong>Request ID:</strong> ${escapeHtml(input.siteRequestId)}</p>` +
      `<p><strong>Company:</strong> ${escapeHtml(input.companyName)}</p>` +
      `<p><strong>Contact:</strong> ${escapeHtml(input.contactName)}</p>` +
      `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>` +
      `<p><strong>Phone:</strong> ${escapeHtml(input.phone ?? "N/A")}</p>` +
      `<p><strong>Sector:</strong> ${escapeHtml(input.sector ?? "N/A")}</p>` +
      `<p><strong>Needs:</strong><br/>${escapeHtml(input.needs)}</p>`,
    text:
      `New website creation request submitted. ` +
      `Request ID: ${input.siteRequestId}. ` +
      `Company: ${input.companyName}. ` +
      `Contact: ${input.contactName}. ` +
      `Email: ${input.email}. ` +
      `Phone: ${input.phone ?? "N/A"}. ` +
      `Sector: ${input.sector ?? "N/A"}. ` +
      `Needs: ${input.needs}`,
    payload: {
      site_request_id: input.siteRequestId,
      company_name: input.companyName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      sector: input.sector,
      audience: "admin",
    },
  });
}
