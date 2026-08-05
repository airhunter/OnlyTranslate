import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppI18n } from '@/entrypoints/utils/i18n';

const mocks = vi.hoisted(() => ({
  listRecentBooks: vi.fn(),
  getProgress: vi.fn(),
  importBook: vi.fn(),
  extractEpubMetadata: vi.fn(),
  closeRepository: vi.fn(),
  createTab: vi.fn(),
}));

vi.mock('@/entrypoints/ebook/repository', () => ({
  EbookImportError: class EbookImportError extends Error {},
  EbookRepository: class {
    listRecentBooks = mocks.listRecentBooks;
    getProgress = mocks.getProgress;
    importBook = mocks.importBook;
    close = mocks.closeRepository;
  },
}));

vi.mock('@/entrypoints/ebook/readerController', () => ({
  extractEpubMetadata: mocks.extractEpubMetadata,
}));

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getManifest: () => ({ version: '1.1.1' }),
      getURL: (path: string) => `chrome-extension://onlytranslate${path}`,
      openOptionsPage: vi.fn(),
      sendMessage: vi.fn(async () => ({ success: true })),
    },
    tabs: {
      create: mocks.createTab,
      query: vi.fn(async () => []),
      sendMessage: vi.fn(async () => ({ status: 'success' })),
    },
  },
}));

const config = ref({
  on: true,
  display: 1,
  service: 'microsoft',
  enableVideoSubtitle: true,
  selectionTranslatorMode: 'disabled',
  translationScope: 'smart',
  theme: 'light',
  uiLocale: 'zh-CN',
  token: {},
  model: {},
  customProviders: [],
  disableFloatingBall: false,
  floatingBallHotkey: 'Alt+T',
  hotkey: 'Control',
});

vi.mock('@/composables/useConfig', () => ({
  useConfig: () => ({ config, loadConfig: vi.fn(async () => undefined) }),
}));

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ updateTheme: vi.fn() }),
}));

vi.mock('@/composables/useReleaseNotes', () => ({
  useReleaseNotes: () => ({
    currentReleaseNote: ref(undefined),
    hasUnreadReleaseNotes: ref(false),
    loadReleaseNotesState: vi.fn(async () => undefined),
    markCurrentReleaseNotesAsSeen: vi.fn(async () => undefined),
  }),
}));

vi.mock('@/entrypoints/utils/option', () => ({
  options: { display: [], services: [] },
  isServiceConfigured: () => true,
}));

vi.mock('@/entrypoints/utils/help', () => ({ openOptionsPanel: vi.fn() }));
vi.mock('@/entrypoints/utils/cache', () => ({ cache: { clean: vi.fn() } }));
vi.mock('@/entrypoints/utils/modelMigration', () => ({
  consumeClaudeModelMigrationNotice: vi.fn(async () => null),
}));

import Main from '@/components/Main.vue';

const popupStyles = readFileSync(resolve(process.cwd(), 'entrypoints/popup/style.css'), 'utf8');

describe('Popup ebook shelf', () => {
  let wrapper: ReturnType<typeof mount> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listRecentBooks.mockResolvedValue([{
      bookId: 'book-one',
      fileBlob: new Blob(['epub']),
      filename: 'book.epub',
      fileSize: 4,
      title: 'Popup Book',
      author: 'Reader',
      addedAt: 1,
      lastOpenedAt: 2,
    }]);
    mocks.getProgress.mockResolvedValue({ percentage: .36 });
    mocks.importBook.mockResolvedValue({
      book: {
        bookId: 'imported-book',
        fileBlob: new Blob(['epub']),
        filename: 'imported.epub',
        fileSize: 4,
        title: 'Imported Book',
        author: 'Reader',
        addedAt: 3,
        lastOpenedAt: 3,
      },
      duplicate: false,
    });
  });

  afterEach(() => wrapper?.unmount());

  it('keeps the translation service menu within the popup viewport', async () => {
    wrapper = mount(Main, {
      global: {
        plugins: [createAppI18n()],
        stubs: {
          ElTooltip: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElSwitch: true,
          ElEmpty: true,
          ElSelect: true,
          ElOption: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('.service-select').attributes('popper-class')).toBe('popup-service-select-popper');

    const rule = popupStyles.match(/\.popup-service-select-popper\s+\.el-select-dropdown__wrap\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain('max-height: 180px');
  });

  it('switches to the inline shelf without opening a tab, then deep-links the selected book', async () => {
    wrapper = mount(Main, {
      global: {
        plugins: [createAppI18n()],
        stubs: {
          ElTooltip: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElSwitch: true,
          ElEmpty: true,
          ElSelect: true,
          ElOption: true,
        },
      },
    });
    await flushPromises();

    const navigationButtons = wrapper.findAll('.popup-nav-button');
    expect(navigationButtons).toHaveLength(3);
    expect(navigationButtons[0].text()).toBe('网页');
    expect(navigationButtons[1].text()).toContain('电子书');
    expect(navigationButtons[1].find('.popup-nav-beta').text()).toBe('BETA');
    expect(navigationButtons[2].text()).toBe('设置');
    expect(wrapper.find('.footer-actions').exists()).toBe(false);
    expect(wrapper.find('.footer-shortcuts').exists()).toBe(false);

    await wrapper.find('.utility-menu-trigger').trigger('click');
    expect(wrapper.find('.utility-menu').text()).toContain('清空缓存');
    expect(wrapper.find('.utility-menu').text()).toContain('帮助');
    expect(wrapper.find('.utility-menu').text()).toContain('官方网站');

    await wrapper.find('.official-website-menu-item').trigger('click');
    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'https://onlytranslate.top/',
    });
    mocks.createTab.mockClear();

    await wrapper.findAll('.popup-nav-button')[1].trigger('click');
    await flushPromises();

    expect(mocks.createTab).not.toHaveBeenCalled();
    expect(mocks.listRecentBooks).toHaveBeenCalledOnce();
    expect(wrapper.find('.popup-bookshelf').exists()).toBe(true);
    expect(wrapper.text()).toContain('Popup Book');
    expect(wrapper.text()).toContain('36%');

    mocks.getProgress.mockResolvedValue({ percentage: .58 });
    window.dispatchEvent(new Event('focus'));
    await flushPromises();
    expect(mocks.listRecentBooks).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('58%');

    await wrapper.find('.popup-book').trigger('click');
    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://onlytranslate/ebook.html?bookId=book-one',
    });
  });

  it('opens the file picker and imports the selected EPUB inside the popup', async () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    wrapper = mount(Main, {
      global: {
        plugins: [createAppI18n()],
        stubs: {
          ElTooltip: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElSwitch: true,
          ElEmpty: true,
          ElSelect: true,
          ElOption: true,
        },
      },
    });
    await wrapper.findAll('.popup-nav-button')[1].trigger('click');
    await flushPromises();

    await wrapper.find('.bookshelf-import').trigger('click');
    expect(inputClick).toHaveBeenCalledOnce();

    const file = new File(['epub'], 'selected.epub', { type: 'application/epub+zip' });
    const input = wrapper.find<HTMLInputElement>('.popup-file-input');
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
    await input.trigger('change');
    await flushPromises();

    expect(mocks.importBook).toHaveBeenCalledWith(file, mocks.extractEpubMetadata);
    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://onlytranslate/ebook.html?bookId=imported-book',
    });
    inputClick.mockRestore();
  });

});
