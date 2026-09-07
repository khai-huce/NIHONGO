import { GrammarItem } from '../types';

export const GRAMMAR_DATABASE: GrammarItem[] = [
  {
    id: 'g-n5-1',
    pattern: '〜は〜です',
    meaning: 'N1 là N2',
    level: 'N5',
    usage: 'N1 + は + N2 + です',
    explanation: 'Cấu trúc cơ bản nhất trong tiếng Nhật dùng để giới thiệu tên tuổi, nghề nghiệp, quốc tịch hoặc khẳng định đặc tính của chủ ngữ.',
    examples: [
      { japanese: '私は学生です。', furigana: 'わたし は がくせい です。', vietnamese: 'Tôi là sinh viên.' },
      { japanese: '山田さんは日本人です。', furigana: 'やまださん は にほんじん です。', vietnamese: 'Anh Yamada là người Nhật.' }
    ]
  },
  {
    id: 'g-n5-2',
    pattern: '〜てください',
    meaning: 'Xin hãy làm V',
    level: 'N5',
    usage: 'V-て + ください',
    explanation: 'Dùng để nhờ vả, yêu cầu ai đó thực hiện một hành động một cách lịch sự.',
    examples: [
      { japanese: 'ここに名前を書いてください。', furigana: 'ここ に なまえ を かいて ください。', vietnamese: 'Xin hãy viết tên vào đây.' },
      { japanese: '日本語で話してください。', furigana: 'にほんご で はなして ください。', vietnamese: 'Xin hãy nói bằng tiếng Nhật.' }
    ]
  },
  {
    id: 'g-n5-3',
    pattern: '〜てもいいです',
    meaning: 'Làm V có được không / Được phép làm V',
    level: 'N5',
    usage: 'V-て + もいいです',
    explanation: 'Dùng để xin phép hoặc đưa ra sự đồng ý cho phép ai đó làm việc gì.',
    examples: [
      { japanese: '写真を撮ってもいいですか。', furigana: 'しゃしん を とっても いいですか。', vietnamese: 'Tôi có thể chụp ảnh ở đây được không?' },
      { japanese: 'ここでタバコを吸ってもいいです。', furigana: 'ここ で たばこ を すっても いいです。', vietnamese: 'Bạn có thể hút thuốc ở đây.' }
    ]
  },
  {
    id: 'g-n4-1',
    pattern: '〜てみる',
    meaning: 'Thử làm V',
    level: 'N4',
    usage: 'V-て + みる',
    explanation: 'Biểu thị việc thử làm một hành động nào đó để xem kết quả ra sao.',
    examples: [
      { japanese: '日本の納豆を食べてみます。', furigana: 'にほん の なっとう を たべて みます。', vietnamese: 'Tôi sẽ ăn thử món Natto của Nhật.' },
      { japanese: 'この靴を履いてみてもいいですか。', furigana: 'この くつ を はいて みても いいですか。', vietnamese: 'Tôi đi thử đôi giày này được không?' }
    ]
  },
  {
    id: 'g-n3-1',
    pattern: '〜わけにはいかない',
    meaning: 'Không thể làm V (vì lý do đạo đức/xã hội)',
    level: 'N3',
    usage: 'V-る / V-ない + わけにはいかない',
    explanation: 'Không thể làm (hoặc buộc phải làm) một việc gì đó vì ràng buộc đạo đức, tâm lý hoặc quan niệm xã hội.',
    examples: [
      { japanese: '大事な会議があるので、休むわけにはいかない。', furigana: 'だいじ な かいぎ が あるので、やすむ わけ には いかない。', vietnamese: 'Vì có cuộc họp quan trọng nên tôi không thể nghỉ được.' }
    ]
  }
];
