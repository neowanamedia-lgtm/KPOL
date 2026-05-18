import type { ThemeFlow } from '../types';

export const fakeThemes: ThemeFlow[] = [
  {
    id: 't_realestate',
    name: '부동산',
    mentionCount: 412,
    mentionChange: 28.4,
    relatedPoliticianIds: ['p_001', 'p_005'],
  },
  {
    id: 't_ai',
    name: 'AI/기술',
    mentionCount: 318,
    mentionChange: 35.0,
    relatedPoliticianIds: ['p_002'],
  },
  {
    id: 't_youth',
    name: '청년',
    mentionCount: 207,
    mentionChange: 12.8,
    relatedPoliticianIds: ['p_003'],
  },
  {
    id: 't_pension',
    name: '연금',
    mentionCount: 184,
    mentionChange: 19.2,
    relatedPoliticianIds: ['p_006'],
  },
  {
    id: 't_foreign',
    name: '외교안보',
    mentionCount: 161,
    mentionChange: -4.1,
    relatedPoliticianIds: ['p_008'],
  },
  {
    id: 't_transport',
    name: '교통',
    mentionCount: 144,
    mentionChange: 8.7,
    relatedPoliticianIds: ['p_005'],
  },
];
