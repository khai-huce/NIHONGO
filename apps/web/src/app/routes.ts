export const pagePaths: Record<string, string> = {
  kanji: '/kanji',
  'vocab-giao-trinh': '/tu-vung/giao-trinh',
  'vocab-bang-chu-cai': '/tu-vung/bang-chu-cai',
  bunpo: '/ngu-phap',
  'personal-lo-trinh': '/ca-nhan/lo-trinh',
  'personal-on-tap': '/ca-nhan/on-tap',
  'personal-chu-dong': '/ca-nhan/chu-dong',
  accent: '/trong-am',
  leaderboard: '/xep-hang',
  write: '/luyen-viet',
  'lifetime-jlpt': '/tron-doi/jlpt',
  'lifetime-doc-hieu': '/tron-doi/doc-hieu',
  'lifetime-shadowing': '/tron-doi/shadowing',
  upgrade: '/nang-cap',
};

export function pathForTab(tab: string) {
  return pagePaths[tab === 'personal' ? 'personal-lo-trinh' : tab === 'lifetime' ? 'upgrade' : tab] ?? '/kanji';
}

export function tabForPath(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (normalized.startsWith('/kanji/')) return 'kanji';
  if (normalized.startsWith('/ngu-phap/')) return 'bunpo';
  if (normalized.startsWith(`${pagePaths['vocab-giao-trinh']}/`)) return 'vocab-giao-trinh';
  if (normalized.startsWith(`${pagePaths['lifetime-doc-hieu']}/`)) return 'lifetime-doc-hieu';
  if (normalized.startsWith(`${pagePaths['lifetime-shadowing']}/`)) return 'lifetime-shadowing';
  return Object.keys(pagePaths).find(tab => pagePaths[tab] === normalized) ?? '';
}

export const kanjiPath = (id: string) => `/kanji/${encodeURIComponent(id)}`;
export const grammarPath = (id: string) => `/ngu-phap/mau/${encodeURIComponent(id.replace(/^grammar:/, ''))}`;
