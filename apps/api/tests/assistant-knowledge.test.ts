import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { JlptResourceInput, JlptResourceOption, JlptResourceView } from '@nihongo/shared/contracts/jlpt';
import { assistantHelpSources, getAssistantKnowledge, normalizeAssistantRoute, resolveAssistantSources } from '../src/modules/assistant/assistant-knowledge.js';

const { resolve, search } = vi.hoisted(() => ({ resolve: vi.fn(), search: vi.fn() }));
vi.mock('../src/modules/jlpt/jlpt.resources.js', () => ({ resolveResources: resolve, searchResources: search }));
const transaction = vi.fn(async callback => callback({}));
const db = { $transaction: transaction } as unknown as PrismaClient;
const id = '11111111-1111-4111-8111-111111111111';
const option = (overrides: Partial<JlptResourceOption> = {}): JlptResourceOption => ({
  kind: 'grammar', targetId: id, title: 'N も', subtitle: 'N cũng', level: 'N5', available: true,
  href: `/ngu-phap/mau/${id}`, ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
  resolve.mockImplementation(async (_tx: unknown, inputs: JlptResourceInput[]): Promise<JlptResourceView[]> => inputs.map(input => ({
    ...input, title: 'Không còn công khai', subtitle: '', level: null, available: false, href: null,
  })));
});

describe('assistant route privacy and citation allowlist', () => {
  it.each(['https://evil.test/kanji', '//evil.test/kanji', '/\\evil.test', '/admin/kanji', '/api/auth/me', '/kanji/%2e%2e', '/kanji/k-1\n'])('rejects non-learner or unsafe context %s', value => {
    expect(normalizeAssistantRoute(value)).toBeNull();
  });
  it('keeps only allowed public UI selectors, never attempt/account/search identifiers', () => {
    expect(normalizeAssistantRoute(`/tron-doi/jlpt?level=N5&attempt=${id}&session=${id}&expectedUserId=${id}#secret`)).toBe('/tron-doi/jlpt?level=N5');
    expect(normalizeAssistantRoute(`/ca-nhan/lo-trinh?tab=my&roadmap=${id}&day=2`)).toBe('/ca-nhan/lo-trinh?tab=my');
    expect(normalizeAssistantRoute(`/tu-vung/giao-trinh/nihongo-n5/review/${id}?name=secret`)).toBe('/tu-vung/giao-trinh/nihongo-n5');
    expect(normalizeAssistantRoute('/kanji?q=secret&email=private@example.test')).toBe('/kanji');
    expect(normalizeAssistantRoute('/ca-nhan/on-tap?type=vocab')).toBe('/ca-nhan/on-tap?type=vocab');
    expect(normalizeAssistantRoute('/tu-vung/bang-chu-cai?script=katakana')).toBe('/tu-vung/bang-chu-cai?script=katakana');
    expect(normalizeAssistantRoute('/')).toBe('/kanji');
  });
  it('static sources have stable unique IDs, actual allowed learner routes and bounded content', () => {
    expect(new Set(assistantHelpSources.map(source => source.id)).size).toBe(assistantHelpSources.length);
    for (const source of assistantHelpSources) {
      expect(source.id).toMatch(/^help:[a-z]+$/);
      expect(normalizeAssistantRoute(source.url)).toBe(source.url);
      expect(source.content.length).toBeLessThan(1600);
    }
  });
});

describe('assistant public help and live catalog citations', () => {
  it('answers ordinary UI help from feature facts without querying account or catalog data', async () => {
    const sources = await getAssistantKnowledge(db, { question: 'Bỏ sao có mất lịch ôn tập không?', currentRoute: '/ca-nhan/on-tap' });
    expect(sources.some(source => source.id === 'help:review' && source.content.includes('giữ lịch/lịch sử'))).toBe(true);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('identifies unavailable payment/file features instead of promising working checkout', async () => {
    const sources = await getAssistantKnowledge(db, { question: 'Làm sao mua gói?', currentRoute: '/nang-cap' });
    expect(sources.find(source => source.id === 'help:unavailable')?.content).toContain('chưa có luồng mua hàng/thanh toán');
  });
  it('resolves the current detail from public projection; missing/private content is not cited', async () => {
    const sources = await getAssistantKnowledge(db, { question: 'Hướng dẫn màn này', currentRoute: `/tron-doi/doc-hieu/${id}` });
    expect(resolve).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ kind: 'reading', targetId: id })]);
    expect(sources.every(source => source.id.startsWith('help:'))).toBe(true);
  });
  it('searches only bounded extracted terms and re-resolves before exposing links', async () => {
    const selected = option();
    search.mockResolvedValue({ items: [selected], page: 1, pageSize: 25, total: 1 });
    resolve.mockImplementation(async (_tx: unknown, inputs: JlptResourceInput[]) => inputs.map(input => ({ ...selected, id: input.id })));
    const sources = await getAssistantKnowledge(db, { question: 'Tìm mẫu ngữ pháp 「N も」 hoặc 「です」 ở N5', currentRoute: '/ngu-phap' });
    expect(search.mock.calls.length).toBeLessThanOrEqual(6);
    for (const call of search.mock.calls) expect(call[1]).toMatchObject({ page: 1, level: 'N5' });
    expect(resolve).toHaveBeenCalled();
    expect(sources.find(source => source.id === `resource:grammar:${id}`)).toMatchObject({ title: 'N も', url: `/ngu-phap/mau/${id}` });
    expect(sources.length).toBeLessThanOrEqual(10);
    expect(sources.reduce((sum, source) => sum + source.content.length, 0)).toBeLessThanOrEqual(14000);
  });
  it('does not accept an unsafe href even if a future catalog resolver accidentally supplies one', async () => {
    resolve.mockResolvedValue([{ ...option({ href: 'https://evil.test' }), id: `resource:grammar:${id}` }]);
    const sources = await resolveAssistantSources(db, [`resource:grammar:${id}`]);
    expect(sources).toEqual([]);
  });
  it('cached source IDs are refreshed; archived source disappears and unknown IDs cannot create URLs', async () => {
    const sources = await resolveAssistantSources(db, ['help:review', `resource:grammar:${id}`, 'help:admin', 'resource:reading:../../secret', 'https://evil.test']);
    expect(sources.map(source => source.id)).toEqual(['help:review']);
    expect(resolve.mock.calls[0][1]).toEqual([{ id: `resource:grammar:${id}`, kind: 'grammar', targetId: id }]);
  });
  it('refreshes catalog metadata and never uses a saved content snapshot', async () => {
    resolve.mockResolvedValue([{ ...option({ title: 'Mẫu vừa sửa' }), id: `resource:grammar:${id}` }]);
    const sources = await resolveAssistantSources(db, [`resource:grammar:${id}`, `resource:grammar:${id}`]);
    expect(sources).toHaveLength(1);
    expect(sources[0].title).toBe('Mẫu vừa sửa');
    expect(sources[0].content).toContain('Mẫu vừa sửa');
  });
});
