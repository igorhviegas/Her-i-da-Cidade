export function authorizeAdminRequest(req: unknown, env?: Record<string, string | undefined>): Promise<'unauthenticated' | 'forbidden' | 'authorized'>;
