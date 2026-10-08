export const PNG_IMAGE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('not really pixels'),
]);

export const PDF_DOCUMENT = Buffer.from('%PDF-1.7 not an image', 'latin1');
