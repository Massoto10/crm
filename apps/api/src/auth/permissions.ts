// Permissões modulares por departamento (funcionalidade + escopo).
// Cada departamento define quais telas seus atendentes acessam e se enxergam
// só as próprias conversas ou todas. Admin ignora tudo isso (acesso total).

export type ViewKey = "chats" | "dashboard" | "settings" | "scheduling" | "contacts";

export const VIEW_KEYS: ViewKey[] = ["chats", "dashboard", "settings", "scheduling", "contacts"];

export type ConversationScope = "own" | "all";

export interface DeptPermissions {
  views: Record<ViewKey, boolean>;
  scope: ConversationScope;
}

// Padrão de um departamento operacional (ex.: Vendas) com permissões em branco.
export const DEFAULT_PERMISSIONS: DeptPermissions = {
  views: { chats: true, dashboard: false, settings: false, scheduling: true, contacts: true },
  scope: "own"
};

// Admin enxerga e faz tudo.
export const ADMIN_PERMISSIONS: DeptPermissions = {
  views: { chats: true, dashboard: true, settings: true, scheduling: true, contacts: true },
  scope: "all"
};

/** Normaliza um JSON arbitrário (Department.permissions) para DeptPermissions completo. */
export function normalizePermissions(raw: unknown): DeptPermissions {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<DeptPermissions>;
  const views = (obj.views && typeof obj.views === "object" ? obj.views : {}) as Partial<Record<ViewKey, boolean>>;
  return {
    views: {
      chats: views.chats ?? DEFAULT_PERMISSIONS.views.chats,
      dashboard: views.dashboard ?? DEFAULT_PERMISSIONS.views.dashboard,
      settings: views.settings ?? DEFAULT_PERMISSIONS.views.settings,
      scheduling: views.scheduling ?? DEFAULT_PERMISSIONS.views.scheduling,
      contacts: views.contacts ?? DEFAULT_PERMISSIONS.views.contacts
    },
    scope: obj.scope === "all" ? "all" : "own"
  };
}
