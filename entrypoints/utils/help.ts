import browser from 'webextension-polyfill'

export type OptionsPanel = 'service' | 'appearance' | 'interaction' | 'ai' | 'general' | 'help' | 'about'

export const optionsPanels: OptionsPanel[] = ['service', 'appearance', 'interaction', 'ai', 'general', 'help', 'about']

export interface HelpSection {
  id: string
  titleKey: string
  bodyKey: string
  stepKeys?: string[]
  image?: string
  imageAltKey?: string
}

export interface HelpTopic {
  id: string
  titleKey: string
  summaryKey: string
  keywordsKey: string
  sections: HelpSection[]
}

export const helpTopics: HelpTopic[] = [
  {
    id: 'quick-start',
    titleKey: 'help.topics.quickStart.title',
    summaryKey: 'help.topics.quickStart.summary',
    keywordsKey: 'help.topics.quickStart.keywords',
    sections: [
      {
        id: 'first-translation',
        titleKey: 'help.topics.quickStart.firstTranslationTitle',
        bodyKey: 'help.topics.quickStart.firstTranslationBody',
        image: '/help/popup-overview.png',
        imageAltKey: 'help.images.popupOverview',
        stepKeys: [
          'help.topics.quickStart.firstTranslationStep1',
          'help.topics.quickStart.firstTranslationStep2',
          'help.topics.quickStart.firstTranslationStep3',
          'help.topics.quickStart.firstTranslationStep4',
        ],
      },
      {
        id: 'recommended-defaults',
        titleKey: 'help.topics.quickStart.defaultsTitle',
        bodyKey: 'help.topics.quickStart.defaultsBody',
      },
    ],
  },
  {
    id: 'modes',
    titleKey: 'help.topics.modes.title',
    summaryKey: 'help.topics.modes.summary',
    keywordsKey: 'help.topics.modes.keywords',
    sections: [
      {
        id: 'scope',
        titleKey: 'help.topics.modes.scopeTitle',
        bodyKey: 'help.topics.modes.scopeBody',
        stepKeys: [
          'help.topics.modes.scopeStep1',
          'help.topics.modes.scopeStep2',
          'help.topics.modes.scopeStep3',
        ],
      },
      {
        id: 'display',
        titleKey: 'help.topics.modes.displayTitle',
        bodyKey: 'help.topics.modes.displayBody',
        stepKeys: [
          'help.topics.modes.displayStep1',
          'help.topics.modes.displayStep2',
          'help.topics.modes.displayStep3',
        ],
      },
    ],
  },
  {
    id: 'features',
    titleKey: 'help.topics.features.title',
    summaryKey: 'help.topics.features.summary',
    keywordsKey: 'help.topics.features.keywords',
    sections: [
      {
        id: 'webpage',
        titleKey: 'help.topics.features.webpageTitle',
        bodyKey: 'help.topics.features.webpageBody',
        stepKeys: [
          'help.topics.features.webpageStep1',
          'help.topics.features.webpageStep2',
          'help.topics.features.webpageStep3',
          'help.topics.features.webpageStep4',
        ],
      },
      {
        id: 'selection',
        titleKey: 'help.topics.features.selectionTitle',
        bodyKey: 'help.topics.features.selectionBody',
        image: '/help/interaction-settings.png',
        imageAltKey: 'help.images.interactionSettings',
        stepKeys: [
          'help.topics.features.selectionStep1',
          'help.topics.features.selectionStep2',
          'help.topics.features.selectionStep3',
        ],
      },
      {
        id: 'hover',
        titleKey: 'help.topics.features.hoverTitle',
        bodyKey: 'help.topics.features.hoverBody',
        stepKeys: [
          'help.topics.features.hoverStep1',
          'help.topics.features.hoverStep2',
          'help.topics.features.hoverStep3',
        ],
      },
      {
        id: 'input',
        titleKey: 'help.topics.features.inputTitle',
        bodyKey: 'help.topics.features.inputBody',
        stepKeys: [
          'help.topics.features.inputStep1',
          'help.topics.features.inputStep2',
          'help.topics.features.inputStep3',
        ],
      },
      {
        id: 'subtitle',
        titleKey: 'help.topics.features.subtitleTitle',
        bodyKey: 'help.topics.features.subtitleBody',
        stepKeys: [
          'help.topics.features.subtitleStep1',
          'help.topics.features.subtitleStep2',
          'help.topics.features.subtitleStep3',
          'help.topics.features.subtitleStep4',
        ],
      },
    ],
  },
  {
    id: 'services',
    titleKey: 'help.topics.services.title',
    summaryKey: 'help.topics.services.summary',
    keywordsKey: 'help.topics.services.keywords',
    sections: [
      {
        id: 'service-types',
        titleKey: 'help.topics.services.typesTitle',
        bodyKey: 'help.topics.services.typesBody',
        image: '/help/service-settings.png',
        imageAltKey: 'help.images.serviceSettings',
      },
      {
        id: 'chrome',
        titleKey: 'help.topics.services.chromeTitle',
        bodyKey: 'help.topics.services.chromeBody',
        stepKeys: [
          'help.topics.services.chromeStep1',
          'help.topics.services.chromeStep2',
          'help.topics.services.chromeStep3',
          'help.topics.services.chromeStep4',
        ],
      },
      {
        id: 'deepseek',
        titleKey: 'help.topics.services.deepseekTitle',
        bodyKey: 'help.topics.services.deepseekBody',
        stepKeys: [
          'help.topics.services.deepseekStep1',
          'help.topics.services.deepseekStep2',
          'help.topics.services.deepseekStep3',
          'help.topics.services.deepseekStep4',
          'help.topics.services.deepseekStep5',
        ],
      },
      {
        id: 'silicon-cloud',
        titleKey: 'help.topics.services.siliconCloudTitle',
        bodyKey: 'help.topics.services.siliconCloudBody',
        stepKeys: [
          'help.topics.services.siliconCloudStep1',
          'help.topics.services.siliconCloudStep2',
          'help.topics.services.siliconCloudStep3',
          'help.topics.services.siliconCloudStep4',
          'help.topics.services.siliconCloudStep5',
        ],
      },
      {
        id: 'custom-gateway',
        titleKey: 'help.topics.services.customTitle',
        bodyKey: 'help.topics.services.customBody',
        stepKeys: [
          'help.topics.services.customStep1',
          'help.topics.services.customStep2',
          'help.topics.services.customStep3',
          'help.topics.services.customStep4',
          'help.topics.services.customStep5',
          'help.topics.services.customStep6',
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    titleKey: 'help.topics.troubleshooting.title',
    summaryKey: 'help.topics.troubleshooting.summary',
    keywordsKey: 'help.topics.troubleshooting.keywords',
    sections: [
      {
        id: 'not-translating',
        titleKey: 'help.topics.troubleshooting.notTranslatingTitle',
        bodyKey: 'help.topics.troubleshooting.notTranslatingBody',
      },
      {
        id: 'missed-content',
        titleKey: 'help.topics.troubleshooting.missedContentTitle',
        bodyKey: 'help.topics.troubleshooting.missedContentBody',
      },
      {
        id: 'token',
        titleKey: 'help.topics.troubleshooting.tokenTitle',
        bodyKey: 'help.topics.troubleshooting.tokenBody',
      },
      {
        id: 'subtitle',
        titleKey: 'help.topics.troubleshooting.subtitleTitle',
        bodyKey: 'help.topics.troubleshooting.subtitleBody',
      },
      {
        id: 'chrome',
        titleKey: 'help.topics.troubleshooting.chromeTitle',
        bodyKey: 'help.topics.troubleshooting.chromeBody',
      },
      {
        id: 'cache',
        titleKey: 'help.topics.troubleshooting.cacheTitle',
        bodyKey: 'help.topics.troubleshooting.cacheBody',
      },
    ],
  },
  {
    id: 'faq',
    titleKey: 'help.topics.faq.title',
    summaryKey: 'help.topics.faq.summary',
    keywordsKey: 'help.topics.faq.keywords',
    sections: [
      {
        id: 'privacy',
        titleKey: 'help.topics.faq.privacyTitle',
        bodyKey: 'help.topics.faq.privacyBody',
      },
      {
        id: 'page-support',
        titleKey: 'help.topics.faq.pageSupportTitle',
        bodyKey: 'help.topics.faq.pageSupportBody',
      },
    ],
  },
]

export function resolveOptionsRoute(search: string): { panel: OptionsPanel } {
  const params = new URLSearchParams(search)
  const panel = params.get('panel')
  return {
    panel: optionsPanels.includes(panel as OptionsPanel) ? panel as OptionsPanel : 'service',
  }
}

export async function openOptionsPanel(panel: OptionsPanel): Promise<void> {
  const params = new URLSearchParams({ panel })

  try {
    await browser.tabs.create({
      url: browser.runtime.getURL(`/options.html?${params.toString()}`),
    })
  } catch {
    await browser.runtime.openOptionsPage()
  }
}

export interface FeedbackIssueContext {
  version: string
  locale: string
  userAgent: string
}

export function buildFeedbackIssueUrl(context: FeedbackIssueContext): string {
  const body = [
    '## Problem description',
    '',
    '<!-- Describe what happened. -->',
    '',
    '## Steps to reproduce',
    '',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Expected behavior',
    '',
    '',
    '## Actual behavior',
    '',
    '',
    '## Page URL (optional)',
    '',
    '<!-- Add the affected page URL manually if you are comfortable sharing it. -->',
    '',
    '## Environment',
    '',
    `- OnlyTranslate: v${context.version}`,
    `- UI locale: ${context.locale}`,
    `- Browser: ${context.userAgent}`,
  ].join('\n')

  const params = new URLSearchParams({
    title: '[Help] ',
    body,
  })

  return `https://github.com/airhunter/OnlyTranslate/issues/new?${params.toString()}`
}
