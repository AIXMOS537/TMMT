import Link from 'next/link'
import { CheckCircle2, PauseCircle } from 'lucide-react'
import { createSSRClient } from '@/lib/supabase-server'
import { Card } from '@/components/ui'
import { getAgentFleet, type AgentFleetView } from '@/lib/agent-visibility'
import { PauseControl } from './PauseControl'

export const metadata = {
  title: 'What we run for you',
  description: 'Everything working on your account, and how to stop it.',
}

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  // RLS-respecting read: a client can only ever see their own licence row.
  let fleet: AgentFleetView | null = null
  let signedIn = false

  try {
    const supabase = await createSSRClient()
    const { data: { user } } = await supabase.auth.getUser()
    signedIn = Boolean(user)
    if (signedIn) fleet = await getAgentFleet(supabase)
  } catch {
    signedIn = false
    fleet = null
  }

  if (!signedIn) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">What we run for you</h1>
        <Card className="mt-4 p-4">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Sign in to see everything working on your account.
          </p>
          <Link href="/login" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Sign in
          </Link>
        </Card>
      </div>
    )
  }

  if (!fleet) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">What we run for you</h1>
        <Card className="mt-4 p-4">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Nothing is set up on your account yet. When it is, everything we run shows up here
            and you can stop it from this page.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">What we run for you</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Everything working on your account. You can stop all of it, any time, yourself.
        </p>
      </header>

      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          {fleet.paused ? (
            <>
              <PauseCircle className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Stopped</span>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                — nothing below is running
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-semibold text-gray-900 dark:text-white">Running</span>
            </>
          )}
        </div>

        {fleet.agents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Nothing is switched on for you yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {fleet.agents.map((a) => (
              <li key={a.key} className={`flex items-start gap-3 ${fleet.paused ? 'opacity-50' : ''}`}>
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${fleet.paused ? 'bg-gray-400' : 'bg-green-500'}`} />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{a.label}</div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">{a.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
          {fleet.paused ? 'Start it again' : 'Stop everything'}
        </h2>
        <PauseControl paused={fleet.paused} disabled={fleet.protectedOrg} />
      </Card>
    </div>
  )
}
