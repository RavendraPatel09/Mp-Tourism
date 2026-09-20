import { Logger } from '@nestjs/common';

/**
 * Fail fast on missing secrets rather than booting a server that will 500 on
 * first login. Only enforced outside development — local dev falls back to the
 * documented defaults in `.env.example`.
 */
const REQUIRED_IN_PRODUCTION = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'REDIS_HOST',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_BASE_URL',
];

const DEV_PLACEHOLDERS = ['dev-access-secret-change-me', 'dev-refresh-secret-change-me'];

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = (env.NODE_ENV as string) ?? 'development';
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return env;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const placeholders = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter((key) =>
    DEV_PLACEHOLDERS.includes(env[key] as string),
  );
  if (placeholders.length) {
    throw new Error(`Refusing to start with development secrets in ${nodeEnv}: ${placeholders}`);
  }

  if (env.OTP_PROVIDER === 'dev') {
    new Logger('EnvValidation').warn(
      'OTP_PROVIDER=dev in a non-development environment — OTPs are returned in API responses.',
    );
  }

  return env;
}
