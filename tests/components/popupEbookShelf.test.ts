import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppI18n } from '@/entrypoints/utils/i18n';
import type { CustomProvider } from '@/entrypoints/utils/model';

const mocks = vi.hoisted(() => ({
  listRecentBooks: vi.fn(),
  getProgress: vi.fn(),
  importBook: vi.fn(),
  extractEpubMetadata: vi.fn(),
  closeRepository: vi.fn(),
  createTab: vi.fn(),
  openOptionsPage: vi.fn(),
  openOptionsPanel: vi.fn(),
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
      openOptionsPage: mocks.openOptionsPage,
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
  token: {} as Record<string, string>,
  model: {},
  customProviders: [] as CustomProvider[],
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

vi.mock('@/entrypoints/utils/help', () => ({ openOptionsPanel: mocks.openOptionsPanel }));
vi.mock('@/entrypoints/utils/cache', () => ({ cache: { clean: vi.fn() } }));
vi.mock('@/entrypoints/utils/modelMigration', () => ({
  consumeClaudeModelMigrationNotice: vi.fn(async () => null),
}));
vi.mock('@/entrypoints/utils/displayModeMigration', () => ({
  consumeDisplayModeMigrationNotice: vi.fn(async () => null),
}));

import Main from '@/components/Main.vue';

describe('Popup ebook shelf', () => {
  let wrapper: ReturnType<typeof mount> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    config.value.service = 'microsoft';
    config.value.token = {};
    config.value.customProviders = [];
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

  afterEach(() => {
    const element = wrapper?.element;
    wrapper?.unmount();
    element?.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mountServicePopup() {
    return mount(Main, {
      attachTo: document.body,
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
  }

  it('groups DeepSeek and Bailian together and excludes incomplete services', async () => {
    config.value.token = { deepseek: 'test-key', moonshot: 'test-key' };
    config.value.customProviders = [
      { id: 'custom_bailian', name: '百炼', url: 'https://example.com/v1', token: '', model: '', customModel: '' },
      { id: 'custom_incomplete', name: '未配置接口', url: '', token: '', model: '', customModel: '' },
    ];
    wrapper = mountServicePopup();
    await flushPromises();
    await wrapper.find('.service-select').trigger('click');
    await flushPromises();

    const menu = wrapper.find('.service-panel');
    const values = menu.findAll('[data-value]').map(item => item.attributes('data-value'));
    expect(values).toEqual([
      '__keyless_header__', 'microsoft', 'google', 'chromeTranslator',
      '__configured_header__', 'deepseek', 'moonshot', 'custom_bailian',
    ]);
    expect(menu.find('[data-value="__keyless_header__"]').text()).toBe('免 API Key 服务');
    expect(menu.find('[data-value="__configured_header__"]').text()).toBe('已配置服务');
    expect(menu.text()).not.toMatch(/内置服务|更多 AI 服务|自定义接口/);
  });

  it('omits the configured group when empty and uses the footer settings for management', async () => {
    wrapper = mountServicePopup();
    await flushPromises();
    await wrapper.find('.service-select').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-value="__configured_header__"]').exists()).toBe(false);
    expect(wrapper.find('.service-panel-list').text()).not.toContain('管理服务');
    expect(wrapper.find('.popup-footer').attributes()).not.toHaveProperty('inert');
    await wrapper.findAll('.popup-nav-button')[2].trigger('click');
    expect(config.value.service).toBe('microsoft');
    expect(mocks.openOptionsPage).toHaveBeenCalledOnce();
    expect(wrapper.find('.service-panel').exists()).toBe(false);
  });

  it('keeps a separate management shortcut that opens service settings without switching service', async () => {
    wrapper = mountServicePopup();
    await flushPromises();
    await wrapper.find('.service-select').trigger('click');
    await flushPromises();
    expect(wrapper.find('.service-panel-actions .service-panel-manage').text()).toBe('管理服务');
    expect(wrapper.find('.service-panel-list .service-panel-manage').exists()).toBe(false);
    await wrapper.find('.service-panel-manage').trigger('click');
    await flushPromises();
    expect(mocks.openOptionsPanel).toHaveBeenCalledWith('service');
    expect(config.value.service).toBe('microsoft');
    expect(wrapper.find('.service-panel').exists()).toBe(false);
  });

  it('opens an overlay in the existing body, focuses the current service and restores focus on Escape', async () => {
    wrapper = mountServicePopup();
    await flushPromises();
    await wrapper.find('.service-select').trigger('click');
    await flushPromises();
    expect(wrapper.find('.popup-body .service-panel').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.find('[data-value="microsoft"]').element);
    expect(wrapper.find('.popup-header').attributes()).not.toHaveProperty('inert');
    expect(wrapper.find('.popup-footer').attributes()).not.toHaveProperty('inert');
    await wrapper.find('.service-panel').trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(config.value.service).toBe('microsoft');
    expect(wrapper.find('.service-panel').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.find('.service-select').element);
    expect(wrapper.find('.popup-header').attributes()).not.toHaveProperty('inert');
  });

  it('supports two-column arrow navigation, selection, collapse button and dismissal outside the panel', async () => {
    wrapper = mountServicePopup();
    await flushPromises();
    await wrapper.find('.service-select').trigger('click');
    await flushPromises();
    for (const [index, option] of wrapper.findAll('.service-panel-option').entries()) {
      vi.spyOn(option.element, 'getBoundingClientRect').mockReturnValue({ top: Math.floor(index / 2) * 38, left: (index % 2) * 164 } as DOMRect);
    }
    await wrapper.find('[data-value="microsoft"]').trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(wrapper.find('[data-value="google"]').element);
    await wrapper.find('[data-value="google"]').trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(wrapper.find('[data-value="chromeTranslator"]').element);
    await wrapper.find('[data-value="google"]').trigger('click');
    await flushPromises();
    expect(config.value.service).toBe('google');
    expect(wrapper.find('.service-select').text()).toBe('Google 翻译');
    expect(wrapper.find('.service-panel').exists()).toBe(false);
    await wrapper.find('.service-select').trigger('click');
    expect(wrapper.find('.service-panel-collapse').text()).toBe('收起');
    await wrapper.find('.service-panel-collapse').trigger('click');
    expect(wrapper.find('.service-panel').exists()).toBe(false);
    await wrapper.find('.service-select').trigger('click');
    await flushPromises();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('.service-panel').exists()).toBe(false);
  });

  it('allows Tab to reach footer navigation and constrains its height to a smaller viewport', async () => {
    vi.stubGlobal('innerHeight', 350);
    wrapper = mountServicePopup();
    await flushPromises();
    vi.spyOn(wrapper.find('.popup-body').element, 'getBoundingClientRect').mockReturnValue({ top: 56 } as DOMRect);
    await wrapper.find('.service-select').trigger('click');
    await flushPromises();
    expect(wrapper.find('.service-panel').attributes('style')).toContain('max-height: 286px');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    wrapper.find('[data-value="microsoft"]').element.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    expect(wrapper.find('.popup-footer').attributes()).not.toHaveProperty('inert');
    vi.stubGlobal('innerHeight', 300);
    window.dispatchEvent(new Event('resize'));
    await flushPromises();
    expect(wrapper.find('.service-panel').attributes('style')).toContain('max-height: 236px');
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
    expect(navigationButtons[1].text()).toContain('阅读');
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
    expect(wrapper.find('.bookshelf-heading h2').text()).toBe('书架');
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

    expect(mocks.importBook).toHaveBeenCalledWith(file, expect.any(Function));
    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://onlytranslate/ebook.html?bookId=imported-book',
    });
    inputClick.mockRestore();
  });

  it('opens saved PDF records in the PDF reader', async () => {
    mocks.listRecentBooks.mockResolvedValue([{
      bookId: 'pdf-one',
      fileBlob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
      filename: 'paper.pdf',
      fileSize: 8,
      format: 'pdf',
      sourceType: 'remote',
      sourceUrl: 'https://example.com/paper.pdf',
      title: 'Paper',
      author: '',
      addedAt: 1,
      lastOpenedAt: 2,
    }]);
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
    await wrapper.find('.popup-book').trigger('click');

    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://onlytranslate/pdf.html?bookId=pdf-one',
    });
  });

});
