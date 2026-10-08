import { MailerOptions } from '@nestjs-modules/mailer';
import * as path from 'path';

import { HandlebarsTemplateAdapter } from './handlebars.adapter';
import { MAIL_ACTION_TEMPLATE } from './mail.constants';

describe('HandlebarsTemplateAdapter', () => {
  const options: MailerOptions = {
    template: { dir: path.join(__dirname, 'templates') },
  };

  const render = (
    template: string,
    context: Record<string, unknown>,
  ): Promise<string> => {
    const adapter = new HandlebarsTemplateAdapter();
    const mail = {
      data: { template, context } as {
        template: string;
        context: Record<string, unknown>;
        html?: string;
      },
    };

    return new Promise((resolve, reject) => {
      adapter.compile(
        mail,
        (error?: unknown) =>
          error
            ? reject(
                new Error(
                  (error as { message?: string }).message ?? 'Render failed',
                ),
              )
            : resolve(mail.data.html ?? ''),
        options,
      );
    });
  };

  const frame = {
    lang: 'en',
    title: 'Confirm your email address',
    footer: 'Automated message',
    appName: 'Ecommerce',
  };

  it('wraps the template in the shared layout', async () => {
    const html = await render(MAIL_ACTION_TEMPLATE, {
      ...frame,
      greeting: 'Hello Son,',
      actionUrl: 'https://shop.example.com/verify-email?token=abc',
    });

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Confirm your email address</title>');
    expect(html).toContain('Hello Son,');
    expect(html).toContain('Automated message');
  });

  it('puts the link in both the button and the fallback text', async () => {
    const html = await render(MAIL_ACTION_TEMPLATE, {
      ...frame,
      actionUrl: 'https://shop.example.com/verify-email?token=abc',
    });

    expect(
      html.split('https://shop.example.com/verify-email?token&#x3D;abc'),
    ).toHaveLength(3);
  });

  it('escapes user input', async () => {
    const html = await render(MAIL_ACTION_TEMPLATE, {
      ...frame,
      greeting: 'Hello <script>alert(1)</script>,',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('reports a missing template through the callback', async () => {
    await expect(render('no-such-template', frame)).rejects.toThrow(/ENOENT/);
  });

  it('refuses a template name that reaches outside the directory', async () => {
    await expect(render('../../etc/passwd', frame)).rejects.toThrow(
      'Invalid mail template name',
    );
  });
});
