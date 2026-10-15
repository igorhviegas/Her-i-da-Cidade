export function getAdminFirestore(env?: Record<string, string | undefined>): any;
export function getAdminAccessToken(env?: Record<string, string | undefined>): Promise<{ token: string; projectId: string }>;
export function hasAdminCredentials(env?: Record<string, string | undefined>): boolean;
