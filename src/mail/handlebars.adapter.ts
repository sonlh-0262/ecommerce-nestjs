import { MailerOptions, TemplateAdapter } from '@nestjs-modules/mailer';
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import * as path from 'path';

import { MAIL_LAYOUT_TEMPLATE } from './mail.constants';

interface CompilableMail {
  data: {
    template?: string;
    context?: Record<string, unknown>;
    html?: string;
  };
}

const TEMPLATE_NAME = /^[a-z0-9-]+$/;

export class HandlebarsTemplateAdapter implements TemplateAdapter {
  private readonly handlebars = Handlebars.create();
  private readonly compiled = new Map<string, Handlebars.TemplateDelegate>();

  compile(
    mail: CompilableMail,
    callback: (error?: unknown, body?: string) => void,
    options: MailerOptions,
  ): void {
    try {
      const directory = options.template?.dir ?? '';
      const context = mail.data.context ?? {};
      const body = this.template(directory, mail.data.template)(context);

      mail.data.html = this.template(
        directory,
        MAIL_LAYOUT_TEMPLATE,
      )({
        ...context,
        body: new this.handlebars.SafeString(body),
      });

      callback();
    } catch (error) {
      callback(error);
    }
  }

  private template(
    directory: string,
    name: string | undefined,
  ): Handlebars.TemplateDelegate {
    if (!name || !TEMPLATE_NAME.test(name)) {
      throw new Error(`Invalid mail template name "${name}"`);
    }

    const file = path.join(directory, `${name}.hbs`);
    const cached = this.compiled.get(file);

    if (cached) {
      return cached;
    }

    const template = this.handlebars.compile(readFileSync(file, 'utf8'));

    this.compiled.set(file, template);

    return template;
  }
}
