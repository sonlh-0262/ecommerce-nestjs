import { ExecutionContext, Injectable } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';

import { LANGUAGE_ALIASES } from '../constants/languages';

interface RequestWithHeaders {
  headers?: Record<string, string | string[] | undefined>;
  raw?: { headers?: Record<string, string | string[] | undefined> };
}

/**
 * Resolves `Accept-Language` through {@link LANGUAGE_ALIASES}.
 *
 * The bundled `AcceptLanguageResolver` negotiates the header against the
 * catalogue folder names and gives up when nothing matches exactly, which
 * happens for regional tags such as `vi-VN`. That negotiation runs before
 * `nestjs-i18n`'s own `fallbacks` are consulted, so the alias has to be applied
 * here instead.
 *
 * Returning `undefined` lets the next resolver in the chain take over.
 */
@Injectable()
export class AcceptLanguageAliasResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    if (context.getType() !== 'http') {
      return undefined;
    }

    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const header =
      request.raw?.headers?.['accept-language'] ??
      request.headers?.['accept-language'];

    if (typeof header !== 'string' || header.length === 0) {
      return undefined;
    }

    for (const tag of parseAcceptLanguage(header)) {
      const language =
        LANGUAGE_ALIASES[tag] ?? LANGUAGE_ALIASES[tag.split('-')[0]];

      if (language) {
        return language;
      }
    }

    return undefined;
  }
}

/**
 * Splits an `Accept-Language` header into its tags, most preferred first.
 * `en;q=0.8, vi-VN, vi;q=0.9` -> `['vi-vn', 'vi', 'en']`.
 */
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='));

      const weight = quality ? Number.parseFloat(quality.slice(2)) : 1;

      return {
        tag: tag.trim().toLowerCase(),
        // A malformed or missing q-value is treated as the default, 1.
        weight: Number.isNaN(weight) ? 1 : weight,
      };
    })
    .filter(({ tag, weight }) => tag.length > 0 && tag !== '*' && weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ tag }) => tag);
}
