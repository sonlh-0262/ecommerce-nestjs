import { AllowedImageType } from '../attachments.constants';

export interface ImageType {
  mime: AllowedImageType;
  extension: string;
}

interface Signature extends ImageType {
  bytes: number[];
  verify?: (buffer: Buffer) => boolean;
}

const WEBP_FORM_TYPE_OFFSET = 8;
const WEBP_FORM_TYPE = 'WEBP';

const SIGNATURES: Signature[] = [
  { mime: 'image/jpeg', extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  {
    mime: 'image/png',
    extension: 'png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    bytes: [0x52, 0x49, 0x46, 0x46],
    verify: (buffer) =>
      buffer
        .subarray(
          WEBP_FORM_TYPE_OFFSET,
          WEBP_FORM_TYPE_OFFSET + WEBP_FORM_TYPE.length,
        )
        .toString('latin1') === WEBP_FORM_TYPE,
  },
];

function matches(buffer: Buffer, signature: Signature): boolean {
  if (buffer.length < signature.bytes.length) {
    return false;
  }

  if (!signature.bytes.every((byte, index) => buffer[index] === byte)) {
    return false;
  }

  return signature.verify ? signature.verify(buffer) : true;
}

export function detectImageType(buffer: Buffer): ImageType | null {
  const signature = SIGNATURES.find((candidate) => matches(buffer, candidate));

  return signature
    ? { mime: signature.mime, extension: signature.extension }
    : null;
}
