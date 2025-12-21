// Group Helper utilities for ID lookups
import { Group } from './rbac';

/**
 * Find group ID by name from user's groups
 */
export const findGroupIdByName = (groups: Group[], groupName: string): string | null => {
  const group = groups.find(g => g.name === groupName);
  return group?.id || null;
};

/**
 * Common group names used in the application
 */
export const COMMON_GROUPS = {
  SUPER_ADMIN: 'super-admin',
  PLATFORM_ADMIN: 'platform-admin',
  ACCOUNT_GOV: 'account-gov',
  ACCOUNT_SUPER_ADMIN: 'account-super-admin'
} as const;

/**
 * Get group ID for a common group name from user context
 */
export const getCommonGroupId = (groups: Group[], groupName: keyof typeof COMMON_GROUPS): string | null => {
  return findGroupIdByName(groups, COMMON_GROUPS[groupName]);
};