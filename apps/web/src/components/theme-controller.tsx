'use client';

import { useEffect } from 'react';
import { useCrm } from '@/context/crm-context';
import { applyThemePreference, normalizeThemePreference } from '@/lib/theme';

const storageKey = 'stn_crm_theme';

export function ThemeController() {
  const { settings } = useCrm();
  const storedPreference = settings.appearance_theme;

  useEffect(() => {
    const preference = normalizeThemePreference(storedPreference ?? window.localStorage.getItem(storageKey));
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => applyThemePreference(preference);

    window.localStorage.setItem(storageKey, preference);
    apply();
    if (preference !== 'system') return;

    mediaQuery.addEventListener('change', apply);
    return () => mediaQuery.removeEventListener('change', apply);
  }, [storedPreference]);

  return null;
}
