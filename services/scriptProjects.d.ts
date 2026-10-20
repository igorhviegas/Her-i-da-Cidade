export interface ScriptProject { id: string; name: string; icon: string }

export const CAIXINHA_PROJECT_ID: 'caixinha';
export const DEFAULT_ICON: string;
export const DEFAULT_PROJECTS: Array<{ id: string | null; name: string; icon: string }>;
export const PROJECT_NAME_MAX: number;
export function cleanProject(input: { name: string; icon: string }): { name: string; icon: string };
export function matchesProject(projectId: string | undefined, filter: string, knownIds: Set<string>): boolean;
