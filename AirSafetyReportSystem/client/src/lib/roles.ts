export const CAPTAIN_ROLES = ['captain', 'under_training_captain'] as const;
export const FIRST_OFFICER_ROLES = ['first_officer', 'under_training_first_officer'] as const;
export const ADMIN_LIKE_ROLES = [
  'admin',
  'flight_operation_manager',
  'flight_operation_and_crew_affairs_manager',
  'flight_operations_training_manager',
  'chief_pilot_a330',
  'chief_pilot_a320',
  'technical_pilot_a330',
  'technical_pilot_a320',
  'head_of_safety_department',
  'head_of_compliance',
] as const;

export type CaptainLikeRole = typeof CAPTAIN_ROLES[number];
export type FirstOfficerLikeRole = typeof FIRST_OFFICER_ROLES[number];
export type AdminLikeRole = typeof ADMIN_LIKE_ROLES[number];

export function isCaptainLike(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return CAPTAIN_ROLES.includes(r as CaptainLikeRole);
}

export function isFirstOfficerLike(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return FIRST_OFFICER_ROLES.includes(r as FirstOfficerLikeRole);
}

export function canCreateReports(role?: string): boolean {
  return isCaptainLike(role) || isFirstOfficerLike(role);
}

export function isAdminLike(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return ADMIN_LIKE_ROLES.includes(r as AdminLikeRole);
}


