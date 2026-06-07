import { clientStatusLabel, clientStatusMessage } from "@/lib/client-updates/messages";
import type { CaseStatus } from "@/lib/workflow/statuses";
import { clientLoginUrl, clientUpdatesUrl, trackCaseUrl } from "@/lib/portal-links";
import { addContactTag, isGhlConfigured, sendConversationMessage } from "./client";
import { resolveGhlContactId } from "./resolve-contact";
import { syncContactPortalFields } from "./sync-contact-portal-fields";

function portalNotifyChannels(): { sms: boolean; email: boolean } {
  const raw = (process.env.GHL_PORTAL_NOTIFY ?? "workflow").toLowerCase();
  if (raw === "false" || raw === "off") return { sms: false, email: false };
  if (raw === "workflow") return { sms: false, email: false };
  return {
    sms: raw.includes("sms"),
    email: raw.includes("email"),
  };
}

function smsBody(args: { refCode: string; title: string; body: string }) {
  return [
    `TMMT update — ${args.refCode}`,
    args.title,
    args.body,
    `Track: ${trackCaseUrl(args.refCode)}`,
    `Portal: ${clientUpdatesUrl()}`,
  ].join("\n");
}

function emailHtml(args: { refCode: string; title: string; body: string }) {
  const track = trackCaseUrl(args.refCode);
  const login = clientLoginUrl();
  return `<p>${args.body}</p>
<p><strong>Reference:</strong> ${args.refCode}</p>
<p><a href="${track}">Check status without calling</a> · <a href="${login}">Sign in to the portal</a></p>
<p style="color:#666;font-size:12px">Please check the portal before calling for updates.</p>`;
}

/**
 * Notify clients via GHL (SMS through OpenPhone when connected in LC, email through GHL).
 * Syncs merge fields, adds workflow tags. Enable direct SMS/email with GHL_PORTAL_NOTIFY=sms,email.
 */
export async function notifyClientPortalUpdate(args: {
  caseId: string;
  refCode: string;
  customerEmail: string;
  title: string;
  body: string;
  kind: "status_change" | "team_message";
  status?: CaseStatus;
  ghlContactId?: string | null;
}): Promise<void> {
  if (!isGhlConfigured()) return;

  try {
    await syncContactPortalFields({
      refCode: args.refCode,
      caseId: args.caseId,
      customerEmail: args.customerEmail,
      ghlContactId: args.ghlContactId,
    });

    const contactId = await resolveGhlContactId({
      caseId: args.caseId,
      customerEmail: args.customerEmail,
      ghlContactId: args.ghlContactId,
    });
    if (!contactId) return;

    const tag =
      args.kind === "status_change" && args.status
        ? `tmmt-case-${args.status.replace(/_/g, "-")}`
        : "tmmt-portal-team-message";

    await addContactTag(contactId, tag);
    await addContactTag(contactId, "tmmt-portal-alert");

    const channels = portalNotifyChannels();
    if (!channels.sms && !channels.email) return;

    const displayTitle =
      args.kind === "status_change" && args.status
        ? clientStatusLabel(args.status)
        : args.title;
    const displayBody =
      args.kind === "status_change" && args.status
        ? clientStatusMessage(args.status)
        : args.body;

    if (channels.sms) {
      await sendConversationMessage({
        contactId,
        type: "SMS",
        message: smsBody({
          refCode: args.refCode,
          title: displayTitle,
          body: displayBody,
        }),
      });
    }

    if (channels.email) {
      await sendConversationMessage({
        contactId,
        type: "Email",
        subject: `${args.refCode}: ${displayTitle}`,
        message: displayBody,
        html: emailHtml({
          refCode: args.refCode,
          title: displayTitle,
          body: displayBody,
        }),
      });
    }
  } catch (err) {
    console.error("[ghl] notifyClientPortalUpdate", args.caseId, err);
  }
}
