'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { profile as profileApi } from '@/lib/api'
import { CandidateProfile, RemotePreference, SearchUrgency } from '@/types'
import { Topbar } from '@/components/layout/Topbar'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function ProfileCompletion() {
  const router = useRouter()
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    profileApi.get().then(res => {
      setProfile(res.profile)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading your profile...</div>
  }

  if (!profile) {
    return <div className="p-12 text-center text-red-500">Could not load profile.</div>
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await profileApi.upsert(profile)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Topbar eyebrow="Onboarding · Step 3 of 3" title="Review Your Profile" />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6 pb-24">
          <p className="text-slate-600">
            We&rsquo;ve built your profile based on our chat. You can adjust anything here before we move on.
          </p>

          <Card title="Career Goals">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Roles</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={profile.targetRoles.join(', ')}
                  placeholder="e.g. Product Manager, Senior PM"
                  onChange={(e) => setProfile({ ...profile, targetRoles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Industries</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={profile.industries.join(', ')}
                  placeholder="e.g. FinTech, Healthcare"
                  onChange={(e) => setProfile({ ...profile, industries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
            </div>
          </Card>

          <Card title="Preferences">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Locations</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={profile.locations.join(', ')}
                  placeholder="e.g. New York, Remote"
                  onChange={(e) => setProfile({ ...profile, locations: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remote Preference</label>
                <select
                  className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={profile.remotePreference}
                  onChange={(e) => setProfile({ ...profile, remotePreference: e.target.value as RemotePreference })}
                >
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ONSITE">On-site</option>
                  <option value="OPEN">Open</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title="Compensation & Status">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Salary</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    value={profile.salaryMin || ''}
                    onChange={(e) => setProfile({ ...profile, salaryMin: parseInt(e.target.value) || null })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Salary</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    value={profile.salaryMax || ''}
                    onChange={(e) => setProfile({ ...profile, salaryMax: parseInt(e.target.value) || null })}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    value={profile.salaryCurrency}
                    onChange={(e) => setProfile({ ...profile, salaryCurrency: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Search Urgency</label>
                <select
                  className="w-full border p-2 rounded shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={profile.urgency}
                  onChange={(e) => setProfile({ ...profile, urgency: e.target.value as SearchUrgency })}
                >
                  <option value="ACTIVELY_LOOKING">Actively Looking</option>
                  <option value="OPEN_TO_OPPORTUNITIES">Open to Opportunities</option>
                  <option value="NOT_LOOKING">Not Looking</option>
                </select>
              </div>
            </div>
          </Card>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Skip for now
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              Save & Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
