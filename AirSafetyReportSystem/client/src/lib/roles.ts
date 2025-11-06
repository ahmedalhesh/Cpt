export const CAPTAIN_ROLES = ['captain', 'under_training_captain'] as const;
export const FIRST_OFFICER_ROLES = ['first_officer', 'under_training_first_officer'] as const;

export type CaptainLikeRole = typeof CAPTAIN_ROLES[number];
export type FirstOfficerLikeRole = typeof FIRST_OFFICER_ROLES[number];

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


