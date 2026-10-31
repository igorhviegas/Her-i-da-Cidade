export function groupPlaces(events: { lat?: number; lng?: number; label: string; upcoming: boolean }[]): {
  kind: 'visited' | 'upcoming'; lat: number; lng: number; count: number; label: string;
}[];
export function eventKey(eventDate: string, childName: string): string;
