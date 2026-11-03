export function groupPlaces(events: { id: string; lat?: number; lng?: number; label: string; upcoming: boolean }[]): {
  kind: 'visited' | 'upcoming'; lat: number; lng: number; count: number; ids: string[]; label: string;
}[];
export function eventKey(eventDate: string, childName: string): string;
