import type { SessionFilter, SessionType } from '../types';

export function pathForSessionType(sessionType: SessionType): string {
  switch (sessionType) {
    case 'research':
      return '/research';
    case 'compare':
      return '/compare';
    case 'interview':
      return '/interview';
    case 'coverletter':
      return '/coverletter';
    case 'salary':
      return '/salary';
    case 'general':
    default:
      return '/chat';
  }
}

export function pathForSessionFilter(sessionFilter: SessionFilter): string {
  if (sessionFilter === 'all') {
    return '/chat';
  }
  return pathForSessionType(sessionFilter);
}
