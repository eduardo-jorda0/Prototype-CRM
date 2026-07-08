export const Role = {
  ADMIN: 'ADMIN',
  CLOSER: 'CLOSER',
  ASSESSOR: 'ASSESSOR',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: RoleType[] = [Role.ADMIN, Role.CLOSER, Role.ASSESSOR];

export default Role;
