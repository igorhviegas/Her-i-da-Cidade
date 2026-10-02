export type ServiceColor = 'red' | 'yellow' | 'blue' | 'purple' | 'green';
export function getServiceColor(service?: { id?: string; title?: string; name?: string } | null): ServiceColor | null;
