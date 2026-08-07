export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Sem preferencia salva, o sistema abre no tema claro.
 *
 * O padrao era 'system', que herda o modo do sistema operacional: quem usa o
 * computador no escuro entrava num CRM escuro sem nunca ter pedido isso. Quem
 * quiser escuro escolhe em Configuracoes, e a escolha continua sendo respeitada.
 */
export function normalizeThemePreference(value?: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'light';
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === 'undefined') return;

  const resolved = preference === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
