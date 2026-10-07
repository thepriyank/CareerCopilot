/**
 * Settings tab deep links, e.g. /settings?tab=plan. Lets upgrade prompts
 * (NM-5) — and anything else — land users on the right tab instead of the
 * Settings default (API keys).
 */
export const SETTINGS_TAB_SLUGS: Record<string, string> = {
  'Profile': 'profile',
  'API keys': 'api-keys',
  'Privacy & data': 'privacy',
  'Plan': 'plan',
  'Extensions': 'extensions',
  'Notifications': 'notifications',
  'Export': 'export',
}

export type SettingsTab = keyof typeof SETTINGS_TAB_SLUGS

export function settingsHref(tab: SettingsTab): string {
  return `/settings?tab=${SETTINGS_TAB_SLUGS[tab]}`
}

/** The tab named by a `?tab=` slug, or null if it isn't one. */
export function tabFromSlug(slug: string | null): string | null {
  return Object.entries(SETTINGS_TAB_SLUGS).find(([, s]) => s === slug)?.[0] ?? null
}
