import { ImageType } from '../validators/image-signature';

export type UploadedImage = Pick<
  Express.Multer.File,
  'originalname' | 'buffer'
>;

export interface ValidatedImage extends UploadedImage {
  type: ImageType;
}
