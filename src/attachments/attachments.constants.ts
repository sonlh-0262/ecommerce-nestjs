import { AttachableType } from './enums/attachable-type.enum';
import { ImageUploadSpec } from './interfaces/image-upload-spec.interface';

export const URL_MAX_LENGTH = 500;
export const FILE_NAME_MAX_LENGTH = 255;
export const FILE_TYPE_MAX_LENGTH = 100;
export const STORAGE_PATH_MAX_LENGTH = 500;

export const ATTACHMENTS_ATTACHABLE_INDEX = 'IDX_attachments_attachable';
export const ATTACHMENTS_FILE_SIZE_CHECK = 'CHK_attachments_file_size';
export const ATTACHMENTS_FILE_SIZE_EXPRESSION = 'file_size > 0';

export const UNIQUE_ATTACHMENTS_AVATAR_INDEX = 'UQ_attachments_avatar';
export const ATTACHMENTS_AVATAR_CONDITION = "attachable_type = 'User'";

export const BYTES_PER_MEGABYTE = 1024 * 1024;
export const MAX_FILE_SIZE_MEGABYTES = 2;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MEGABYTES * BYTES_PER_MEGABYTE;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const IMAGE_UPLOAD_FIELD = 'file';

export const SINGLE_IMAGE_UPLOAD: ImageUploadSpec = {
  field: IMAGE_UPLOAD_FIELD,
  maxFiles: 1,
  textFields: 0,
};

export const ATTACHMENTS_ROUTE = 'attachments';

export const FALLBACK_FILE_NAME = 'upload';

export const ATTACHMENT_CACHE_CONTROL = 'private, max-age=31536000, immutable';

export const PUBLIC_ATTACHMENT_CACHE_CONTROL =
  'public, max-age=31536000, immutable';

export const ATTACHMENT_ACCESS: Record<
  AttachableType,
  { isPublic: boolean; cacheControl: string }
> = {
  [AttachableType.User]: {
    isPublic: false,
    cacheControl: ATTACHMENT_CACHE_CONTROL,
  },
  [AttachableType.Product]: {
    isPublic: true,
    cacheControl: PUBLIC_ATTACHMENT_CACHE_CONTROL,
  },
};
