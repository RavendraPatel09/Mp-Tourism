/**
 * Single source of truth for runtime configuration.
 *
 * Everything the app reads from the environment is parsed and coerced here, so
 * services never touch `process.env` directly and never have to guess whether a
 * value is a string or a number.
 */

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const float = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export const configuration = () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: int(process.env.PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? 'v1',
    corsOrigins: list(process.env.CORS_ORIGINS),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: int(process.env.DATABASE_PORT, 5432),
    username: process.env.DATABASE_USER ?? 'bharat',
    password: process.env.DATABASE_PASSWORD ?? 'bharat',
    database: process.env.DATABASE_NAME ?? 'bharat_trails',
    ssl: bool(process.env.DATABASE_SSL),
    logging: bool(process.env.DATABASE_LOGGING),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: int(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: int(process.env.REDIS_DB, 0),
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    otpTtlSeconds: int(process.env.OTP_TTL_SECONDS, 300),
    otpMaxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5),
    otpResendCooldownSeconds: int(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
    otpProvider: (process.env.OTP_PROVIDER ?? 'dev') as 'dev' | 'msg91',
    msg91AuthKey: process.env.MSG91_AUTH_KEY ?? '',
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID ?? '',
  },
  media: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION ?? 'ap-south-1',
    bucket: process.env.S3_BUCKET ?? 'bharat-trails-media-dev',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE),
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
    uploadUrlTtlSeconds: int(process.env.MEDIA_UPLOAD_URL_TTL_SECONDS, 900),
    maxBytes: int(process.env.MEDIA_MAX_BYTES, 10 * 1024 * 1024),
  },
  checkIn: {
    captureWindowSeconds: int(process.env.CHECKIN_CAPTURE_WINDOW_SECONDS, 600),
    gpsAccuracyCeilingM: int(process.env.CHECKIN_GPS_ACCURACY_CEILING_M, 200),
    maxAccuracyM: int(process.env.CHECKIN_MAX_ACCURACY_M, 500),
    impossibleVelocityKmh: int(process.env.CHECKIN_IMPOSSIBLE_VELOCITY_KMH, 900),
    perDayCap: int(process.env.CHECKIN_PER_DAY_CAP, 8),
    destinationCooldownHours: int(process.env.CHECKIN_DESTINATION_COOLDOWN_HOURS, 24),
    phashDistanceThreshold: int(process.env.PHASH_DISTANCE_THRESHOLD, 6),
    trustAutoApproveThreshold: int(process.env.TRUST_AUTO_APPROVE_THRESHOLD, 60),
    auditSampleRate: float(process.env.MODERATION_AUDIT_SAMPLE_RATE, 0.05),
  },
  points: {
    dailyCap: int(process.env.POINTS_DAILY_CAP, 600),
  },
  throttle: {
    ttlSeconds: int(process.env.THROTTLE_TTL_SECONDS, 60),
    limit: int(process.env.THROTTLE_LIMIT, 120),
  },
  observability: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
