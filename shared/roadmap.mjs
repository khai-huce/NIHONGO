// Matches src/data/kanjiData.ts; tests fail if the catalog changes without this mapping.
export const ROADMAP_KANJI = [
  [
    "k-1",
    "一"
  ],
  [
    "k-2",
    "二"
  ],
  [
    "k-3",
    "三"
  ],
  [
    "k-4",
    "四"
  ],
  [
    "k-5",
    "五"
  ],
  [
    "k-6",
    "六"
  ],
  [
    "k-7",
    "七"
  ],
  [
    "k-8",
    "八"
  ],
  [
    "k-9",
    "九"
  ],
  [
    "k-10",
    "十"
  ],
  [
    "k-11",
    "百"
  ],
  [
    "k-12",
    "千"
  ],
  [
    "k-13",
    "万"
  ],
  [
    "k-14",
    "日"
  ],
  [
    "k-15",
    "月"
  ],
  [
    "k-16",
    "火"
  ],
  [
    "k-17",
    "水"
  ],
  [
    "k-18",
    "木"
  ],
  [
    "k-19",
    "金"
  ],
  [
    "k-20",
    "土"
  ],
  [
    "k-21",
    "人"
  ],
  [
    "k-22",
    "休"
  ],
  [
    "k-23",
    "体"
  ],
  [
    "k-24",
    "何"
  ],
  [
    "k-25",
    "学"
  ],
  [
    "k-26",
    "校"
  ],
  [
    "k-27",
    "先"
  ],
  [
    "k-28",
    "生"
  ],
  [
    "k-101",
    "旅"
  ],
  [
    "k-102",
    "館"
  ],
  [
    "k-103",
    "働"
  ],
  [
    "k-201",
    "想"
  ],
  [
    "k-202",
    "恋"
  ],
  [
    "k-301",
    "響"
  ],
  [
    "k-401",
    "鬱"
  ]
];
export const ROADMAP_PER_DAY = [5, 10, 15, 20, 25, 30];
export const MAX_ROADMAP_TEXT = 2000;
export const MAX_ROADMAPS = 100;
const supported = new Set(ROADMAP_KANJI.map(([, character]) => character));

export function extractRoadmapKanji(raw) {
  return [...new Set(raw.match(/\p{Script=Han}/gu) ?? [])];
}

export function analyzeRoadmapKanji(raw) {
  const kanjiList = extractRoadmapKanji(raw);
  return { kanjiList, unsupported: kanjiList.filter(character => !supported.has(character)) };
}

// Days are one-based; navigating outside the plan must never wrap into another day's cards.
export function roadmapDayKanji(kanjiList, perDay, day) {
  if (!Number.isSafeInteger(perDay) || perDay < 1 || !Number.isSafeInteger(day) || day < 1 || day > Math.ceil(kanjiList.length / perDay)) {
    throw new RangeError('Ngày học không tồn tại trong lộ trình.');
  }
  return kanjiList.slice((day - 1) * perDay, day * perDay);
}
