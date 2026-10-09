import { FILE_NAME_MAX_LENGTH } from '../attachments.constants';
import { contentDisposition, sanitiseFileName } from './file-name';

const BACKSLASH = String.fromCharCode(92);

describe('sanitiseFileName', () => {
  it('keeps an ordinary name unchanged', () => {
    expect(sanitiseFileName('avatar.png', 'png')).toBe('avatar.png');
  });

  it('appends the detected extension when the name disagrees with it', () => {
    expect(sanitiseFileName('payload.svg', 'png')).toBe('payload.svg.png');
  });

  it('matches the existing extension case-insensitively', () => {
    expect(sanitiseFileName('AVATAR.PNG', 'png')).toBe('AVATAR.PNG');
  });

  it('adds an extension to a name that has none', () => {
    expect(sanitiseFileName('avatar', 'jpg')).toBe('avatar.jpg');
  });

  it('drops a POSIX directory prefix', () => {
    expect(sanitiseFileName('/etc/passwd', 'png')).toBe('passwd.png');
  });

  it('drops a Windows directory prefix', () => {
    expect(sanitiseFileName(`C:${BACKSLASH}x.png`, 'png')).toBe('x.png');
  });

  it('defeats a traversal attempt in the name', () => {
    expect(sanitiseFileName('../../../etc/shadow', 'png')).toBe('shadow.png');
  });

  it('strips leading dots so the result is never a hidden file', () => {
    expect(sanitiseFileName('...hidden.png', 'png')).toBe('hidden.png');
  });

  it('removes quotes, which would break Content-Disposition', () => {
    expect(sanitiseFileName(`a"b'c.png`, 'png')).toBe('a b c.png');
  });

  it('removes control characters that could forge a header line', () => {
    expect(sanitiseFileName('evil\r\nX.png', 'png')).toBe('evil X.png');
  });

  it('collapses runs of whitespace', () => {
    expect(sanitiseFileName('my    holiday  photo.jpg', 'jpg')).toBe(
      'my holiday photo.jpg',
    );
  });

  it('falls back to a generic name when nothing usable is left', () => {
    expect(sanitiseFileName('...', 'png')).toBe('upload.png');
  });

  it('falls back for an empty name', () => {
    expect(sanitiseFileName('', 'webp')).toBe('upload.webp');
  });

  it('keeps Vietnamese characters, which the column can hold', () => {
    expect(sanitiseFileName('ảnh đại diện.png', 'png')).toBe(
      'ảnh đại diện.png',
    );
  });

  it('never cuts a character in two when truncating', () => {
    const result = sanitiseFileName(`${'😀'.repeat(300)}.png`, 'png');

    expect([...result]).toHaveLength(FILE_NAME_MAX_LENGTH);
    expect(result.endsWith('😀.png')).toBe(true);
  });

  it('truncates to the column width, keeping the extension', () => {
    const result = sanitiseFileName(`${'a'.repeat(400)}.png`, 'png');

    expect(result).toHaveLength(FILE_NAME_MAX_LENGTH);
    expect(result.endsWith('.png')).toBe(true);
  });
});

describe('contentDisposition', () => {
  it('keeps printable ASCII in the quoted name', () => {
    expect(contentDisposition('avatar (1).png')).toBe(
      `inline; filename="avatar (1).png"; filename*=UTF-8''avatar%20(1).png`,
    );
  });

  it('replaces every other character in the quoted name', () => {
    expect(contentDisposition('ảnh đẹp.png')).toContain(
      'filename="_nh __p.png"',
    );
  });

  it('carries the original name percent-encoded', () => {
    expect(contentDisposition('ảnh đẹp.png')).toContain(
      `filename*=UTF-8''${encodeURIComponent('ảnh đẹp.png')}`,
    );
  });

  it('replaces quotes and backslashes, which would end the quoted name', () => {
    expect(contentDisposition(`a"b${BACKSLASH}c.png`)).toContain(
      'filename="a_b_c.png"',
    );
  });

  it('replaces control characters, so a header cannot be split', () => {
    expect(contentDisposition('a\r\nb.png')).toContain('filename="a__b.png"');
  });
});
