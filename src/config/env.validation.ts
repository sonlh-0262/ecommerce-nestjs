import * as Joi from 'joi';

import { SUPPORTED_LANGUAGES } from '../common/constants/languages';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRENGTH_PATTERN,
} from '../users/users.constants';
import {
  JWT_DURATION_PATTERN,
  MAX_BCRYPT_SALT_ROUNDS,
  MAX_PORT,
  MAX_REDIS_DB_INDEX,
  MIN_BCRYPT_SALT_ROUNDS,
  MIN_JWT_SECRET_LENGTH,
  MIN_PORT,
  MIN_PRODUCTION_BCRYPT_SALT_ROUNDS,
  MIN_REDIS_DB_INDEX,
  MIN_THROTTLE_VALUE,
  NO_TRAILING_SLASH_PATTERN,
  WEB_URL_SCHEMES,
} from './config.constants';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export interface EnvironmentVariables {
  NODE_ENV?: Environment;
  PORT?: number;
  APP_NAME?: string;
  API_PREFIX?: string;
  FALLBACK_LANGUAGE?: string;
  SWAGGER_PATH?: string;
  SWAGGER_ENABLED?: string;

  DB_HOST?: string;
  DB_PORT?: number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_DATABASE?: string;
  DB_SCHEMA?: string;
  DB_SSL?: string;
  DB_LOGGING?: string;

  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  REDIS_DB?: number;
  REDIS_KEY_PREFIX?: string;

  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  JWT_ISSUER?: string;
  BCRYPT_SALT_ROUNDS?: number;

  THROTTLE_TTL?: number;
  THROTTLE_LIMIT?: number;

  MAIL_HOST?: string;
  MAIL_PORT?: number;
  MAIL_USER?: string;
  MAIL_PASSWORD?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  APP_WEB_URL?: string;

  STORAGE_ROOT?: string;

  SEED_ADMIN_EMAIL?: string;
  SEED_ADMIN_PASSWORD?: string;
}

const requiredInProduction = <T extends Joi.Schema>(schema: T): T =>
  schema.when('NODE_ENV', {
    is: Environment.Production,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }) as T;

const EMAIL_OPTIONS: Joi.EmailOptions = { tlds: { allow: false } };

export const envValidationSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid(...Object.values(Environment))
    .optional(),
  PORT: Joi.number().min(MIN_PORT).max(MAX_PORT).optional(),
  APP_NAME: Joi.string().min(1).optional(),
  API_PREFIX: Joi.string().allow('').optional(),
  FALLBACK_LANGUAGE: Joi.string()
    .valid(...SUPPORTED_LANGUAGES)
    .optional(),
  SWAGGER_PATH: Joi.string().min(1).optional(),
  SWAGGER_ENABLED: Joi.string().valid('true', 'false').optional(),

  DB_HOST: Joi.string().min(1).optional(),
  DB_PORT: Joi.number().min(MIN_PORT).max(MAX_PORT).optional(),
  DB_USERNAME: Joi.string().min(1).optional(),
  DB_PASSWORD: Joi.string().allow('').optional(),
  DB_DATABASE: Joi.string().min(1).optional(),
  DB_SCHEMA: Joi.string().min(1).optional(),
  DB_SSL: Joi.string().valid('true', 'false').optional(),
  DB_LOGGING: Joi.string().valid('true', 'false').optional(),

  REDIS_HOST: Joi.string().min(1).optional(),
  REDIS_PORT: Joi.number().min(MIN_PORT).max(MAX_PORT).optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number()
    .min(MIN_REDIS_DB_INDEX)
    .max(MAX_REDIS_DB_INDEX)
    .optional(),
  REDIS_KEY_PREFIX: Joi.string().optional(),

  JWT_SECRET: requiredInProduction(Joi.string().min(MIN_JWT_SECRET_LENGTH)),
  JWT_EXPIRES_IN: Joi.string().pattern(JWT_DURATION_PATTERN).optional(),
  JWT_ISSUER: Joi.string().min(1).optional(),
  BCRYPT_SALT_ROUNDS: Joi.number()
    .min(MIN_BCRYPT_SALT_ROUNDS)
    .max(MAX_BCRYPT_SALT_ROUNDS)
    .when('NODE_ENV', {
      is: Environment.Production,
      then: Joi.number().min(MIN_PRODUCTION_BCRYPT_SALT_ROUNDS),
    })
    .optional(),

  THROTTLE_TTL: Joi.number().integer().min(MIN_THROTTLE_VALUE).optional(),
  THROTTLE_LIMIT: Joi.number().integer().min(MIN_THROTTLE_VALUE).optional(),

  MAIL_HOST: requiredInProduction(Joi.string().min(1)),
  MAIL_PORT: requiredInProduction(Joi.number().min(MIN_PORT).max(MAX_PORT)),
  MAIL_USER: Joi.string().allow('').optional(),
  MAIL_PASSWORD: Joi.string().allow('').optional(),
  MAIL_FROM: requiredInProduction(Joi.string().email(EMAIL_OPTIONS)),
  MAIL_FROM_NAME: Joi.string().min(1).optional(),
  APP_WEB_URL: requiredInProduction(
    Joi.string()
      .uri({ scheme: WEB_URL_SCHEMES })
      .pattern(NO_TRAILING_SLASH_PATTERN),
  ),

  STORAGE_ROOT: Joi.string().min(1).optional(),

  SEED_ADMIN_EMAIL: Joi.string().email(EMAIL_OPTIONS).allow('').optional(),
  SEED_ADMIN_PASSWORD: Joi.string()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .pattern(PASSWORD_STRENGTH_PATTERN)
    .allow('')
    .optional(),
}).unknown(true);
