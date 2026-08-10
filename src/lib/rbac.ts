// Role-Based Access Control definitions

export type UserRole = 'admin' | 'operator' | 'viewer';

export type Panel =
  | 'send-visa' |'schedule' |'captcha' |'benchmarking' |'pulling' |'network' |'api-builder' |'dashboard';

// Panel access matrix: which roles can access each panel
export const PANEL_PERMISSIONS: Record<Panel, UserRole[]> = {
  dashboard: ['admin', 'operator', 'viewer'],
  pulling: ['admin', 'operator', 'viewer'],
  network: ['admin', 'operator', 'viewer'],
  'api-builder': ['admin', 'operator', 'viewer'],
  // Restricted panels
  'send-visa': ['admin', 'operator'],
  schedule: ['admin', 'operator'],
  captcha: ['admin', 'operator'],
  benchmarking: ['admin'],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'text-red-400 bg-red-400/10 border-red-400/20',
  operator: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  viewer: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export function canAccessPanel(role: UserRole | null | undefined, panel: Panel): boolean {
  if (!role) return false;
  return PANEL_PERMISSIONS[panel]?.includes(role) ?? false;
}

export function getAccessDeniedMessage(role: UserRole | null | undefined, panel: Panel): string {
  const roleLabel = role ? ROLE_LABELS[role] : 'Unknown';
  const allowed = PANEL_PERMISSIONS[panel]?.map(r => ROLE_LABELS[r]).join(', ') ?? '';
  return `Access denied. The "${panel}" panel requires: ${allowed}. Your role: ${roleLabel}.`;
}
