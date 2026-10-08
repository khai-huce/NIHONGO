import { useState } from 'react';
import type { LeaderboardEntry } from '@nihongo/shared/contracts/leaderboard';

export function LeaderboardAvatar({ user }: { user: LeaderboardEntry }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = user.name.trim().split(/\s+/u).slice(-2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('vi') || '?';
  return user.avatarUrl && user.avatarUrl !== failedUrl
    ? <img src={user.avatarUrl} alt={user.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setFailedUrl(user.avatarUrl)} />
    : <span aria-label={user.name} className="w-full h-full flex items-center justify-center font-black bg-stone-200 text-stone-700">{initials}</span>;
}
