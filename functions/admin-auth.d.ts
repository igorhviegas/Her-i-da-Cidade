export function authorizeAdminRequest(req: any, env?: Record<string, string | undefined>): Promise<'unauthenticated' | 'forbidden' | 'authorized'>;
