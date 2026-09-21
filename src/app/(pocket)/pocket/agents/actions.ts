'use server'

import { revalidatePath } from 'next/cache'
import { createSSRClient } from '@/lib/supabase-server'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { resolveOrgIdByEmail } from '@/lib/token-ledger'
import { pauseOrgAgents, resumeOrgAgents } from '@/lib/agent-visibility'
import { emitAudit } from '@/lib/agent/audit'

/**
 * The stop button's server side.
 *
 * The organization id is resolved from the SIGNED-IN USER, never taken from the
 * form. That is the whole security model of this action: without it, the button
 * would accept an org id from the browser and pause somebody else's business.
 *
 * The write itself uses the service-role client because `organization_licenses`
 * is staff-managed and a client has no RLS grant to update it — the
 * authorisation happens here, in code we control, rather than by handing the
 * customer a write grant on a licensing table.
 *
 * Every use is audited. A customer stopping their own fleet is legitimate and
 * reversible, but it is still a change to a live system, and "who turned this
 * off and when" must be answerable.
 */
async function actOnOwnOrg(intent: 'pause' | 'resume'): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false, error: 'not_signed_in' }

  const service = createServiceRoleClient()
  const orgId = await resolveOrgIdByEmail(service, user.email)
  if (!orgId) return { ok: false, error: 'no_organization' }

  const result =
    intent === 'pause'
      ? await pauseOrgAgents(service, orgId)
      : await resumeOrgAgents(service, orgId)

  await emitAudit({
    organizationId: orgId,
    action: `client.agents_${intent}`,
    payload: { by: user.email, ok: result.ok, reason: result.reason ?? null },
  })

  if (!result.ok) return { ok: false, error: result.reason }
  revalidatePath('/pocket/agents')
  return { ok: true }
}

export async function pauseMyAgents() {
  return actOnOwnOrg('pause')
}

export async function resumeMyAgents() {
  return actOnOwnOrg('resume')
}
