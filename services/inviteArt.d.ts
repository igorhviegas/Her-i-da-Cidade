export interface InviteArtFields {
  name: string;
  age: string;
  date: string;
  time: string;
  place: string;
}

export function parseInviteFields(order: { content?: unknown; childName?: unknown } | null | undefined, eventDate?: Date | null): InviteArtFields;
export function inviteLines(fields: InviteArtFields): InviteArtFields;
