import type { Service } from '../types';
export type VideoKind = 'birthday' | 'invite';
export const VIDEO_KINDS: Record<VideoKind, { title: string; label: string }>;
export function findVideoService(services: Service[], kind: VideoKind): Service | undefined;
export interface VideoAddons {
  birthday: boolean; birthdayName: string;
  invite: boolean; inviteName: string; inviteAge: string; inviteTime: string; inviteDetails: string;
}
export function buildVideoContents(addons: VideoAddons, event: { eventDate: string; eventTime: string; location: string }):
  { error: string; value?: undefined } | { value: Partial<Record<VideoKind, string>>; error?: undefined };
