export const PAY_EDITOR_MISSION_TITLE: string;
export const PAY_EDITOR_MISSION_SOURCE: string;
export function payEditorMissionId(orderId: string): string;
export function buildPayEditorMission(
  order: { id: string; serviceId?: string; childName?: string; content?: string; editingCost?: number } | null | undefined,
  client: { name?: string } | null | undefined,
  service: { title?: string } | null | undefined,
  completedAt: Date,
): { title: string; description: string; difficulty: number; status: 'pending'; source: string; orderId: string; dueAt: Date } | null;
