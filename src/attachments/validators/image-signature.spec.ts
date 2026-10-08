import { ALLOWED_IMAGE_TYPES } from '../attachments.constants';
import { detectImageType } from './image-signature';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d];

const withPayload = (header: number[]): Buffer =>
  Buffer.concat([Buffer.from(header), Buffer.alloc(32, 0x00)]);

const riff = (formType: string): Buffer =>
  Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from(formType, 'latin1'),
    Buffer.alloc(16, 0x00),
  ]);

describe('detectImageType', () => {
  it('recognises a PNG', () => {
    expect(detectImageType(withPayload(PNG_HEADER))).toEqual({
      mime: 'image/png',
      extension: 'png',
    });
  });

  it('recognises a JPEG', () => {
    expect(detectImageType(withPayload(JPEG_HEADER))).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('recognises a WebP', () => {
    expect(detectImageType(riff('WEBP'))).toEqual({
      mime: 'image/webp',
      extension: 'webp',
    });
  });

  it('rejects a RIFF container that is not WebP', () => {
    expect(detectImageType(riff('WAVE'))).toBeNull();
  });

  it('rejects a GIF, which is an image but not an accepted one', () => {
    expect(detectImageType(withPayload(GIF_HEADER))).toBeNull();
  });

  it('rejects a PDF', () => {
    expect(detectImageType(withPayload(PDF_HEADER))).toBeNull();
  });

  it('rejects SVG, which is markup and can carry script', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="..."></svg>'))).toBeNull();
  });

  it('rejects a buffer shorter than the signature it starts to match', () => {
    expect(detectImageType(Buffer.from(PNG_HEADER.slice(0, 4)))).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('only ever detects an allowed type', () => {
    const detected = [
      withPayload(PNG_HEADER),
      withPayload(JPEG_HEADER),
      riff('WEBP'),
    ].map((buffer) => detectImageType(buffer)?.mime);

    expect([...detected].sort()).toEqual([...ALLOWED_IMAGE_TYPES].sort());
  });
});
