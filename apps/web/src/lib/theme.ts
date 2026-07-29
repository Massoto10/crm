export type ThemePreference = 'light' | 'dark' | 'system';

export function normalizeThemePreference(value?: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === 'undefined') return;

  const resolved = preference === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
