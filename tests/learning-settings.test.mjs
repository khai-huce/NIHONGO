import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, JAPANESE_FONTS, normalizeSettings, japaneseFontFamily } from '../src/utils/learning-settings.ts';

test('new and malformed device settings use the existing Japanese appearance', () => {
  for (const value of [null, undefined, [], 'bad', 1, {}]) {
    assert.deepEqual(normalizeSettings(value), DEFAULT_SETTINGS);
  }
  assert.deepEqual(normalizeSettings({ fontFamily: 'Itim' }), DEFAULT_SETTINGS);
});

test('partial and legacy settings preserve valid preferences', () => {
  assert.deepEqual(normalizeSettings({ fontFamily: 'UD Digi Kyokasho', darkMode: true, showFurigana: 'never', audioSpeed: 1.2 }), {
    fontFamily: 'Klee One', darkMode: true, showFurigana: 'never', audioSpeed: 1.2,
  });
  assert.deepEqual(normalizeSettings({ darkMode: true }), { ...DEFAULT_SETTINGS, darkMode: true });
});

test('saved settings round trip for every font and furigana mode', () => {
  for (const font of JAPANESE_FONTS) {
    for (const showFurigana of ['always', 'hover', 'never']) {
      const settings = { darkMode: true, fontFamily: font.id, showFurigana, audioSpeed: 0.6 };
      assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(settings))), settings);
    }
  }
});

test('device values cannot inject a font or invalid speech rate', () => {
  assert.deepEqual(normalizeSettings({ fontFamily: 'bad; color:red', darkMode: 'false', showFurigana: 'bad', audioSpeed: '1' }), DEFAULT_SETTINGS);
  for (const rate of [NaN, Infinity, -Infinity]) assert.equal(normalizeSettings({ audioSpeed: rate }).audioSpeed, 0.9);
  assert.equal(normalizeSettings({ audioSpeed: 9 }).audioSpeed, 1.3);
  assert.equal(normalizeSettings({ audioSpeed: -1 }).audioSpeed, 0.6);
  assert.equal(normalizeSettings({ audioSpeed: 0.8999999 }).audioSpeed, 0.9);
  assert.equal(japaneseFontFamily('sans-serif'), 'sans-serif');
  assert.match(japaneseFontFamily('Klee One'), /^"Klee One"/);
  assert.match(japaneseFontFamily('invalid'), /^"Zen Maru Gothic"/);
});
