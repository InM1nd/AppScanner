import { z } from "zod";

const emptyAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const optionalNonEmpty = z.preprocess(
  emptyAsUndefined,
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(emptyAsUndefined, z.string().url().optional());
const optionalEmail = z.preprocess(
  emptyAsUndefined,
  z.string().email().optional(),
);
const positiveInteger = (fallback: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().positive())
    .default(fallback);
const hour = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(23))
  .default(8);

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: optionalUrl,
    OWNER_EMAIL: optionalEmail,
    APP_USER_EMAIL: optionalEmail,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalNonEmpty,
    CLERK_SECRET_KEY: optionalNonEmpty,
    INNGEST_EVENT_KEY: optionalNonEmpty,
    INNGEST_SIGNING_KEY: optionalNonEmpty,
    TELEGRAM_ENABLED: z.enum(["true", "false"]).default("false"),
    TELEGRAM_BOT_TOKEN: optionalNonEmpty,
    TELEGRAM_CHAT_ID: optionalNonEmpty,
    ROUTING_PROVIDER: z.enum(["mock", "google"]).default("mock"),
    GOOGLE_MAPS_API_KEY: optionalNonEmpty,
    SCRAPER_MIN_DELAY_MS: positiveInteger(4_000),
    CRAWLER_GLOBAL_FETCH_CAP: positiveInteger(40),
    CRAWLER_PER_SEARCH_FETCH_CAP: positiveInteger(15),
    CRAWLER_CRON: optionalNonEmpty,
    NOTIFY_MIN_SCORE: positiveInteger(70).pipe(z.number().max(100)),
    NOTIFY_DAILY_DIGEST: z.enum(["true", "false"]).default("false"),
    NOTIFY_DIGEST_HOUR: hour,
    APP_TIME_ZONE: z.string().default("Europe/Vienna"),
    IMPORTER_USER_AGENT: optionalNonEmpty,
  })
  .passthrough()
  .superRefine((env, context) => {
    const requireField = (
      field: keyof typeof env,
      condition: boolean,
      message: string,
    ) => {
      if (condition && !env[field])
        context.addIssue({ code: "custom", path: [field], message });
    };

    requireField(
      "DATABASE_URL",
      env.NODE_ENV === "production",
      "DATABASE_URL is required in production.",
    );
    requireField(
      "OWNER_EMAIL",
      env.NODE_ENV === "production",
      "OWNER_EMAIL is required in production.",
    );
    requireField(
      "CLERK_SECRET_KEY",
      env.NODE_ENV === "production",
      "CLERK_SECRET_KEY is required in production.",
    );
    requireField(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      env.NODE_ENV === "production",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production.",
    );
    requireField(
      "INNGEST_EVENT_KEY",
      env.NODE_ENV === "production",
      "INNGEST_EVENT_KEY is required in production.",
    );
    requireField(
      "INNGEST_SIGNING_KEY",
      env.NODE_ENV === "production",
      "INNGEST_SIGNING_KEY is required in production.",
    );
    requireField(
      "TELEGRAM_BOT_TOKEN",
      env.TELEGRAM_ENABLED === "true",
      "Telegram token is required when Telegram is enabled.",
    );
    requireField(
      "TELEGRAM_CHAT_ID",
      env.TELEGRAM_ENABLED === "true",
      "Telegram chat id is required when Telegram is enabled.",
    );
    requireField(
      "GOOGLE_MAPS_API_KEY",
      env.ROUTING_PROVIDER === "google",
      "Google Maps key is required for Google routing.",
    );
  });

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (source !== process.env) return envSchema.parse(source);
  return (cachedEnv ??= envSchema.parse(source));
}
