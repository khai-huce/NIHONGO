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
  'lifetime-tao-file': '/tron-doi/tao-file',
  upgrade: '/nang-cap',
};

export function pathForTab(tab: string) {
  return pagePaths[tab === 'personal' ? 'personal-lo-trinh' : tab === 'lifetime' ? 'upgrade' : tab] ?? '/kanji';
}

export function tabForPath(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (normalized.startsWith('/kanji/')) return 'kanji';
  if (normalized.startsWith('/ngu-phap/')) return 'bunpo';
  if (normalized.startsWith(`${pagePaths['lifetime-doc-hieu']}/`)) return 'lifetime-doc-hieu';
  return Object.keys(pagePaths).find(tab => pagePaths[tab] === normalized) ?? '';
}

export const kanjiPath = (id: string) => `/kanji/${encodeURIComponent(id)}`;
export const grammarPath = (id: string) => `/ngu-phap/${encodeURIComponent(id)}`;
