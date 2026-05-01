import { config } from "@/entrypoints/utils/config";
import { detectlang } from "@/entrypoints/utils/common";

export interface TranslationDirection {
  sourceLang: string;
  targetLang: string;
  shouldTranslate: boolean;
}

function cleanForDetection(origin: string): string {
  return origin.replace(/[\s\u3000]/g, '');
}

export function resolveTranslationDirection(origin: string): TranslationDirection {
  const sourceLang = detectlang(cleanForDetection(origin));
  let targetLang = config.to;

  if (
    config.bidirectionalTranslation &&
    config.bidirectionalTarget &&
    config.bidirectionalTarget !== config.to
  ) {
    targetLang = sourceLang === config.to ? config.bidirectionalTarget : config.to;
  }

  return {
    sourceLang,
    targetLang,
    shouldTranslate: sourceLang !== targetLang,
  };
}

export function shouldTranslateText(origin: string): boolean {
  return resolveTranslationDirection(origin).shouldTranslate;
}
