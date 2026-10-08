import {
  LANGUAGE_ALIASES,
  SupportedLanguage,
} from '../common/constants/languages';
import { MAIL_FALLBACK_LANGUAGE } from './mail.constants';

export function resolveMailLanguage(lang?: string | null): SupportedLanguage {
  const tag = lang?.trim().toLowerCase();

  if (!tag) {
    return MAIL_FALLBACK_LANGUAGE;
  }

  return (
    LANGUAGE_ALIASES[tag] ??
    LANGUAGE_ALIASES[tag.split('-')[0]] ??
    MAIL_FALLBACK_LANGUAGE
  );
}
