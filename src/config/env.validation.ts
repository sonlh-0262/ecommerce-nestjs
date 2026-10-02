import * as Joi from 'joi';

import { SUPPORTED_LANGUAGES } from '../common/constants/languages';
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
}

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

  JWT_SECRET: Joi.string().min(MIN_JWT_SECRET_LENGTH).when('NODE_ENV', {
    is: Environment.Production,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
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
}).unknown(true);
