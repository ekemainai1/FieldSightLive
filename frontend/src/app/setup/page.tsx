'use client'

import { AuthPanel } from '@/components/AuthPanel'
import { SetupPanel } from '@/components/SetupPanel'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/hooks/useTranslation'

export default function SetupPage() {
  const auth = useFirebaseAuth()
  const technicianId = useAppStore((state) => state.selection.technicianId)
  const siteId = useAppStore((state) => state.selection.siteId)
  const setTechnicianId = useAppStore((state) => state.setTechnicianId)
  const setSiteId = useAppStore((state) => state.setSiteId)
  const t = useTranslation()

  const authRequired = String(process.env.NEXT_PUBLIC_AUTH_REQUIRED || 'false').toLowerCase() === 'true'
  const canAccessProtectedApi = !authRequired || Boolean(auth.user)
  const accessMessage = authRequired
    ? 'Authentication required: sign in to load or create technicians and sites.'
    : undefined

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t.setup.createTechnician}</h1>
        <p className="text-muted-foreground">{t.setup.selectTechnician} & {t.setup.selectSite}</p>
      </header>

      <AuthPanel
        available={auth.available}
        loading={auth.loading}
        userEmail={auth.user?.email || null}
        error={auth.error}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onLogout={auth.logout}
      />

      <SetupPanel
        technicianId={technicianId}
        siteId={siteId}
        onTechnicianChange={setTechnicianId}
        onSiteChange={setSiteId}
        canAccessApi={canAccessProtectedApi}
        accessMessage={accessMessage}
      />
    </div>
  )
}
