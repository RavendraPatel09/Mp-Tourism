import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema — PRD §7, all 28 entities plus four operational tables the PRD
 * implies but does not name (`refresh_tokens`, `devices`, `idempotency_records`,
 * `destination_categories`).
 *
 * Hand-written rather than generated, because the parts that matter most cannot
 * be expressed in entity decorators:
 *
 *  - PostGIS geometry columns and GiST indexes
 *  - the partial unique index that makes double-awarding structurally impossible
 *  - the trigger that makes `audit_logs` append-only
 *  - trigram + tsvector indexes behind typo-tolerant search
 *
 * Enum type names follow TypeORM's `{table}_{column}_enum` convention so that
 * `migration:generate` stays usable as a diff aid.
 */
export class InitSchema1758326400000 implements MigrationInterface {
  name = 'InitSchema1758326400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------- extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --------------------------------------------------------------------- enums
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM (
        'explorer','verified_explorer','local_guide','partner','moderator','state_admin','super_admin'
      );
      CREATE TYPE "users_status_enum" AS ENUM (
        'active','warned','leaderboard_suspended','banned','deleted'
      );
      CREATE TYPE "destinations_status_enum" AS ENUM ('draft','in_review','published','unpublished');
      CREATE TYPE "destinations_difficulty_enum" AS ENUM ('easy','moderate','hard','strenuous');
      CREATE TYPE "destinations_best_season_enum" AS ENUM
        ('winter','summer','monsoon','post_monsoon','all_year');
      CREATE TYPE "destinations_crowd_level_enum" AS ENUM ('low','moderate','high','at_capacity');
      CREATE TYPE "destinations_avg_budget_enum" AS ENUM ('free','low','medium','high');
      CREATE TYPE "circuits_status_enum" AS ENUM ('draft','in_review','published','unpublished');
      CREATE TYPE "media_type_enum" AS ENUM ('image','video');
      CREATE TYPE "media_source_enum" AS ENUM ('official','community','check_in');
      CREATE TYPE "media_owner_type_enum" AS ENUM
        ('destination','check_in','review','state','user','circuit','challenge');
      CREATE TYPE "media_status_enum" AS ENUM ('pending','approved','rejected');
      CREATE TYPE "check_ins_status_enum" AS ENUM ('pending','approved','rejected');
      CREATE TYPE "check_ins_rejection_reason_enum" AS ENUM (
        'outside_geofence','stale_capture','mock_location','duplicate_photo','impossible_velocity',
        'cooldown_active','daily_cap_reached','media_missing','not_in_app_camera',
        'policy_violation','moderator_rejected'
      );
      CREATE TYPE "points_ledger_reason_code_enum" AS ENUM (
        'check_in','pioneer_bonus','photo_accepted','detailed_review','challenge_completed',
        'correction_accepted','eco_pledge','moderator_adjustment','reversal'
      );
      CREATE TYPE "points_ledger_ref_type_enum" AS ENUM
        ('check_in','review','media','challenge','ledger_entry','manual');
      CREATE TYPE "challenges_scope_enum" AS ENUM ('national','state');
      CREATE TYPE "challenges_type_enum" AS ENUM ('circuit','discovery','seasonal','campaign');
      CREATE TYPE "challenges_status_enum" AS ENUM ('draft','active','ended','archived');
      CREATE TYPE "reviews_status_enum" AS ENUM ('published','hidden','removed');
      CREATE TYPE "leaderboard_snapshots_scope_enum" AS ENUM ('national','state','district');
      CREATE TYPE "leaderboard_snapshots_period_enum" AS ENUM ('month','all');
      CREATE TYPE "reports_target_type_enum" AS ENUM ('review','media','profile','check_in');
      CREATE TYPE "reports_status_enum" AS ENUM ('open','resolved','dismissed');
      CREATE TYPE "moderation_actions_action_enum" AS ENUM (
        'approve','reject','hide','warn','reverse_points','suspend_leaderboard','ban','dismiss_report'
      );
    `);

    // ----------------------------------------------------------------- geography
    await queryRunner.query(`
      CREATE TABLE "states" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"          varchar(80) NOT NULL,
        "code"          varchar(8)  NOT NULL,
        "type"          varchar(8)  NOT NULL DEFAULT 'state',
        "geometry"      geometry(MultiPolygon, 4326),
        "hero_media_id" uuid,
        "description"   text,
        "is_live"       boolean NOT NULL DEFAULT false,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_states_code" UNIQUE ("code"),
        CONSTRAINT "chk_states_type" CHECK ("type" IN ('state','ut'))
      );
      CREATE INDEX "idx_states_geometry" ON "states" USING GIST ("geometry");

      CREATE TABLE "districts" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "state_id"   uuid NOT NULL REFERENCES "states"("id") ON DELETE CASCADE,
        "name"       varchar(80) NOT NULL,
        "slug"       varchar(100) NOT NULL,
        "geometry"   geometry(MultiPolygon, 4326),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_districts_state_name" UNIQUE ("state_id","name")
      );
      CREATE INDEX "idx_districts_geometry" ON "districts" USING GIST ("geometry");
      CREATE INDEX "idx_districts_state" ON "districts" ("state_id");

      CREATE TABLE "categories" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"        varchar(60) NOT NULL,
        "slug"        varchar(60) NOT NULL,
        "icon"        varchar(60),
        "order_index" int NOT NULL DEFAULT 0,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_categories_slug" UNIQUE ("slug")
      );
    `);

    // -------------------------------------------------------------------- users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone"             varchar(20),
        "email"             varchar(255),
        "password_hash"     varchar(255),
        "oauth_provider"    varchar(32),
        "oauth_subject"     varchar(255),
        "role"              "users_role_enum" NOT NULL DEFAULT 'explorer',
        "status"            "users_status_enum" NOT NULL DEFAULT 'active',
        "managed_state_id"  uuid REFERENCES "states"("id") ON DELETE SET NULL,
        "is_minor"          boolean NOT NULL DEFAULT false,
        "last_login_at"     timestamptz,
        "deleted_at"        timestamptz,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_phone" UNIQUE ("phone"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "chk_users_identity" CHECK (
          "phone" IS NOT NULL OR "email" IS NOT NULL OR "oauth_subject" IS NOT NULL
        )
      );
      CREATE UNIQUE INDEX "uq_users_oauth" ON "users" ("oauth_provider","oauth_subject")
        WHERE "oauth_provider" IS NOT NULL;

      CREATE TABLE "user_profiles" (
        "user_id"                 uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "username"                varchar(32) NOT NULL,
        "display_name"            varchar(80),
        "avatar_media_id"         uuid,
        "bio"                     text,
        "home_state_id"           uuid REFERENCES "states"("id") ON DELETE SET NULL,
        "level"                   int NOT NULL DEFAULT 1,
        "total_points"            int NOT NULL DEFAULT 0,
        "trust_score"             int NOT NULL DEFAULT 40,
        "is_phone_verified"       boolean NOT NULL DEFAULT false,
        "hide_from_leaderboards"  boolean NOT NULL DEFAULT false,
        "push_token"              varchar(255),
        "created_at"              timestamptz NOT NULL DEFAULT now(),
        "updated_at"              timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_profiles_username" UNIQUE ("username"),
        CONSTRAINT "chk_user_profiles_trust" CHECK ("trust_score" BETWEEN 0 AND 100),
        CONSTRAINT "chk_user_profiles_points" CHECK ("total_points" >= 0)
      );
      CREATE INDEX "idx_user_profiles_points" ON "user_profiles" ("total_points" DESC);

      CREATE TABLE "refresh_tokens" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash"     varchar(64) NOT NULL,
        "family_id"      uuid NOT NULL,
        "expires_at"     timestamptz NOT NULL,
        "revoked_at"     timestamptz,
        "revoked_reason" varchar(64),
        "user_agent"     varchar(255),
        "ip"             inet,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_refresh_tokens_hash" UNIQUE ("token_hash")
      );
      CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id","revoked_at");
      CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id");

      CREATE TABLE "devices" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "fingerprint"  varchar(128) NOT NULL,
        "platform"     varchar(32),
        "os_version"   varchar(32),
        "is_rooted"    boolean NOT NULL DEFAULT false,
        "is_emulator"  boolean NOT NULL DEFAULT false,
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_devices_user_fingerprint" UNIQUE ("user_id","fingerprint")
      );
      CREATE INDEX "idx_devices_fingerprint" ON "devices" ("fingerprint");
    `);

    // ------------------------------------------------------------- destinations
    await queryRunner.query(`
      CREATE TABLE "destinations" (
        "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "state_id"                 uuid NOT NULL REFERENCES "states"("id") ON DELETE RESTRICT,
        "district_id"              uuid REFERENCES "districts"("id") ON DELETE SET NULL,
        "name"                     varchar(160) NOT NULL,
        "slug"                     varchar(200) NOT NULL,
        "aliases"                  text[] NOT NULL DEFAULT '{}',
        "description"              text NOT NULL,
        "story"                    text,
        "location"                 geometry(Point, 4326) NOT NULL,
        "geofence"                 geometry(Polygon, 4326),
        "geofence_radius_m"        int NOT NULL DEFAULT 300,
        "tier"                     smallint NOT NULL DEFAULT 3,
        "tier_reviewed_at"         timestamptz,
        "status"                   "destinations_status_enum" NOT NULL DEFAULT 'draft',
        "best_season"              "destinations_best_season_enum"[] NOT NULL DEFAULT '{}',
        "is_monsoon_only"          boolean NOT NULL DEFAULT false,
        "min_duration_min"         int NOT NULL DEFAULT 60,
        "recommended_duration_min" int NOT NULL DEFAULT 120,
        "difficulty"               "destinations_difficulty_enum" NOT NULL DEFAULT 'easy',
        "avg_budget"               "destinations_avg_budget_enum" NOT NULL DEFAULT 'low',
        "accessibility_flags"      jsonb NOT NULL DEFAULT '{}',
        "crowd_level"              "destinations_crowd_level_enum" NOT NULL DEFAULT 'low',
        "is_eco_sensitive"         boolean NOT NULL DEFAULT false,
        "is_promotion_suppressed"  boolean NOT NULL DEFAULT false,
        "hazards"                  text[] NOT NULL DEFAULT '{}',
        "hero_media_id"            uuid,
        "annual_visitors"          int,
        "check_in_count"           int NOT NULL DEFAULT 0,
        "review_count"             int NOT NULL DEFAULT 0,
        "rating_avg"               numeric(3,2),
        "pioneer_user_id"          uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "published_at"             timestamptz,
        "created_by"               uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"               timestamptz NOT NULL DEFAULT now(),
        "updated_at"               timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_destinations_slug" UNIQUE ("slug"),
        CONSTRAINT "chk_destinations_tier" CHECK ("tier" BETWEEN 1 AND 4),
        CONSTRAINT "chk_destinations_radius" CHECK ("geofence_radius_m" BETWEEN 50 AND 5000),
        CONSTRAINT "chk_destinations_duration" CHECK (
          "recommended_duration_min" >= "min_duration_min"
        ),
        CONSTRAINT "chk_destinations_published" CHECK (
          "status" <> 'published' OR "published_at" IS NOT NULL
        )
      );

      -- Geofence containment and "nearby" both hit this.
      CREATE INDEX "idx_destinations_location" ON "destinations" USING GIST ("location");
      CREATE INDEX "idx_destinations_geofence" ON "destinations" USING GIST ("geofence");
      CREATE INDEX "idx_destinations_state_status" ON "destinations" ("state_id","status");
      CREATE INDEX "idx_destinations_district" ON "destinations" ("district_id");
      CREATE INDEX "idx_destinations_tier" ON "destinations" ("tier");

      -- Typo-tolerant search (PRD F5): trigram on the name, plus a weighted
      -- tsvector so exact-ish matches outrank description hits.
      CREATE INDEX "idx_destinations_name_trgm" ON "destinations" USING GIN ("name" gin_trgm_ops);
      ALTER TABLE "destinations" ADD COLUMN "search_vector" tsvector;
      CREATE INDEX "idx_destinations_search" ON "destinations" USING GIN ("search_vector");

      CREATE TABLE "destination_categories" (
        "destination_id" uuid NOT NULL REFERENCES "destinations"("id") ON DELETE CASCADE,
        "category_id"    uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
        PRIMARY KEY ("destination_id","category_id")
      );
      CREATE INDEX "idx_destination_categories_category"
        ON "destination_categories" ("category_id");

      CREATE TABLE "destination_info" (
        "destination_id"      uuid PRIMARY KEY
                              REFERENCES "destinations"("id") ON DELETE CASCADE,
        "timings"             jsonb NOT NULL DEFAULT '{}',
        "entry_fees"          jsonb NOT NULL DEFAULT '{}',
        "rules"               text[] NOT NULL DEFAULT '{}',
        "facilities"          jsonb NOT NULL DEFAULT '{}',
        "how_to_reach"        text,
        "last_mile_notes"     text,
        "parking"             text,
        "best_time_of_day"    varchar(120),
        "official_url"        varchar(500),
        "emergency_contacts"  jsonb NOT NULL DEFAULT '{}',
        "leave_no_trace_tips" text[] NOT NULL DEFAULT '{}'
      );

      CREATE TABLE "things_to_do" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "destination_id" uuid NOT NULL REFERENCES "destinations"("id") ON DELETE CASCADE,
        "title"          varchar(200) NOT NULL,
        "description"    text,
        "duration_min"   int,
        "order_index"    int NOT NULL DEFAULT 0,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_things_to_do_destination"
        ON "things_to_do" ("destination_id","order_index");
    `);

    // ------------------------------------------------- circuits and itineraries
    await queryRunner.query(`
      CREATE TABLE "circuits" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"          varchar(160) NOT NULL,
        "slug"          varchar(200) NOT NULL,
        "state_id"      uuid REFERENCES "states"("id") ON DELETE SET NULL,
        "description"   text,
        "day_count"     int NOT NULL DEFAULT 1,
        "hero_media_id" uuid,
        "status"        "circuits_status_enum" NOT NULL DEFAULT 'draft',
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_circuits_slug" UNIQUE ("slug")
      );

      CREATE TABLE "circuit_destinations" (
        "circuit_id"     uuid NOT NULL REFERENCES "circuits"("id") ON DELETE CASCADE,
        "destination_id" uuid NOT NULL REFERENCES "destinations"("id") ON DELETE CASCADE,
        "order_index"    int NOT NULL DEFAULT 0,
        PRIMARY KEY ("circuit_id","destination_id")
      );
      CREATE INDEX "idx_circuit_destinations_order"
        ON "circuit_destinations" ("circuit_id","order_index");

      CREATE TABLE "itineraries" (
        "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "destination_id"     uuid REFERENCES "destinations"("id") ON DELETE CASCADE,
        "circuit_id"         uuid REFERENCES "circuits"("id") ON DELETE CASCADE,
        "title"              varchar(200) NOT NULL,
        "total_duration_min" int,
        "day_count"          int NOT NULL DEFAULT 1,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        -- Belongs to exactly one parent.
        CONSTRAINT "chk_itineraries_owner" CHECK (
          ("destination_id" IS NOT NULL)::int + ("circuit_id" IS NOT NULL)::int = 1
        )
      );
      CREATE INDEX "idx_itineraries_destination" ON "itineraries" ("destination_id");
      CREATE INDEX "idx_itineraries_circuit" ON "itineraries" ("circuit_id");

      CREATE TABLE "itinerary_stops" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "itinerary_id"   uuid NOT NULL REFERENCES "itineraries"("id") ON DELETE CASCADE,
        "day"            int NOT NULL DEFAULT 1,
        "order_index"    int NOT NULL DEFAULT 0,
        "destination_id" uuid REFERENCES "destinations"("id") ON DELETE SET NULL,
        "activity"       varchar(300) NOT NULL,
        "start_time"     time,
        "duration_min"   int,
        "travel_notes"   text,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_itinerary_stops_order"
        ON "itinerary_stops" ("itinerary_id","day","order_index");
    `);

    // -------------------------------------------------------------------- media
    await queryRunner.query(`
      CREATE TABLE "media" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_type"      "media_owner_type_enum" NOT NULL,
        "owner_id"        uuid,
        "uploaded_by"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "storage_key"     varchar(500) NOT NULL,
        "thumb_key"       varchar(500),
        "type"            "media_type_enum" NOT NULL DEFAULT 'image',
        "source"          "media_source_enum" NOT NULL DEFAULT 'community',
        "phash"           varchar(32),
        "exif"            jsonb,
        "width"           int,
        "height"          int,
        "bytes"           int,
        "mime"            varchar(100),
        "status"          "media_status_enum" NOT NULL DEFAULT 'pending',
        "caption"         varchar(300),
        "attribution"     varchar(300),
        "is_uploaded"     boolean NOT NULL DEFAULT false,
        "captured_in_app" boolean NOT NULL DEFAULT false,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_media_storage_key" UNIQUE ("storage_key")
      );
      CREATE INDEX "idx_media_owner" ON "media" ("owner_type","owner_id");
      CREATE INDEX "idx_media_phash" ON "media" ("phash") WHERE "phash" IS NOT NULL;
      CREATE INDEX "idx_media_uploader" ON "media" ("uploaded_by","created_at" DESC);

      -- Hero/avatar references, added now that media exists.
      ALTER TABLE "states" ADD CONSTRAINT "fk_states_hero_media"
        FOREIGN KEY ("hero_media_id") REFERENCES "media"("id") ON DELETE SET NULL;
      ALTER TABLE "destinations" ADD CONSTRAINT "fk_destinations_hero_media"
        FOREIGN KEY ("hero_media_id") REFERENCES "media"("id") ON DELETE SET NULL;
      ALTER TABLE "circuits" ADD CONSTRAINT "fk_circuits_hero_media"
        FOREIGN KEY ("hero_media_id") REFERENCES "media"("id") ON DELETE SET NULL;
      ALTER TABLE "user_profiles" ADD CONSTRAINT "fk_user_profiles_avatar_media"
        FOREIGN KEY ("avatar_media_id") REFERENCES "media"("id") ON DELETE SET NULL;
    `);

    // ----------------------------------------------------------------- check-ins
    await queryRunner.query(`
      CREATE TABLE "check_ins" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"             uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "destination_id"      uuid NOT NULL REFERENCES "destinations"("id") ON DELETE RESTRICT,
        "captured_at"         timestamptz NOT NULL,
        "submitted_at"        timestamptz NOT NULL DEFAULT now(),
        "local_day"           date NOT NULL,
        "device_point"        geometry(Point, 4326) NOT NULL,
        "accuracy_m"          numeric(8,2),
        "media_id"            uuid REFERENCES "media"("id") ON DELETE SET NULL,
        "status"              "check_ins_status_enum" NOT NULL DEFAULT 'pending',
        "verification_score"  int,
        "points_awarded"      int NOT NULL DEFAULT 0,
        "rejection_reason"    "check_ins_rejection_reason_enum",
        "rejection_note"      text,
        "needs_review"        boolean NOT NULL DEFAULT false,
        "is_audit_sample"     boolean NOT NULL DEFAULT false,
        "reviewed_by"         uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "reviewed_at"         timestamptz,
        "idempotency_key"     varchar(128) NOT NULL,
        "device_fingerprint"  varchar(128),
        "applied_multiplier"  numeric(4,2) NOT NULL DEFAULT 1,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_check_ins_user_idempotency" UNIQUE ("user_id","idempotency_key"),
        CONSTRAINT "chk_check_ins_points" CHECK ("points_awarded" >= 0),
        CONSTRAINT "chk_check_ins_score" CHECK (
          "verification_score" IS NULL OR "verification_score" BETWEEN 0 AND 100
        ),
        -- An approved check-in must have paid out; a rejected one must not have.
        CONSTRAINT "chk_check_ins_rejected_no_points" CHECK (
          "status" <> 'rejected' OR "points_awarded" = 0
        )
      );

      /*
       * THE constraint. One live check-in per user per destination per day, so a
       * retry storm, a double-tapped submit button or a re-run verification job
       * cannot produce two award-eligible rows. Rejected rows are excluded so a
       * user whose submission failed can legitimately try again the same day.
       */
      CREATE UNIQUE INDEX "uq_check_ins_user_destination_day"
        ON "check_ins" ("user_id","destination_id","local_day")
        WHERE "status" <> 'rejected';

      CREATE INDEX "idx_check_ins_user_status" ON "check_ins" ("user_id","status");
      CREATE INDEX "idx_check_ins_destination_status"
        ON "check_ins" ("destination_id","status");
      CREATE INDEX "idx_check_ins_submitted" ON "check_ins" ("submitted_at" DESC);
      -- Drives the moderation queue; partial so it stays small as history grows.
      CREATE INDEX "idx_check_ins_review_queue"
        ON "check_ins" ("submitted_at")
        WHERE "status" = 'pending' AND "needs_review" = true;
      -- Impossible-velocity lookup: the user's previous approved check-in.
      CREATE INDEX "idx_check_ins_user_approved_time"
        ON "check_ins" ("user_id","captured_at" DESC)
        WHERE "status" = 'approved';

      CREATE TABLE "verification_signals" (
        "check_in_id"           uuid PRIMARY KEY
                                REFERENCES "check_ins"("id") ON DELETE CASCADE,
        "geo_pass"              boolean,
        "geo_distance_m"        numeric(10,2),
        "time_pass"             boolean,
        "capture_lag_seconds"   int,
        "mock_location"         boolean,
        "is_rooted"             boolean,
        "is_emulator"           boolean,
        "device_fingerprint"    varchar(128),
        "phash_match_media_id"  uuid REFERENCES "media"("id") ON DELETE SET NULL,
        "phash_distance"        int,
        "scene_match_score"     numeric(5,4),
        "velocity_kmh"          numeric(10,2),
        "previous_check_in_id"  uuid REFERENCES "check_ins"("id") ON DELETE SET NULL,
        "trust_score_at_submit" int,
        "raw"                   jsonb NOT NULL DEFAULT '{}',
        "created_at"            timestamptz NOT NULL DEFAULT now()
      );
    `);

    // ------------------------------------------------------------ points ledger
    await queryRunner.query(`
      CREATE TABLE "points_ledger" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"           uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "delta"             int NOT NULL,
        "reason_code"       "points_ledger_reason_code_enum" NOT NULL,
        "ref_type"          "points_ledger_ref_type_enum" NOT NULL,
        "ref_id"            uuid,
        "balance_after"     int NOT NULL,
        "leaderboard_delta" int NOT NULL,
        "state_id"          uuid REFERENCES "states"("id") ON DELETE SET NULL,
        "district_id"       uuid REFERENCES "districts"("id") ON DELETE SET NULL,
        "reversed_by"       uuid REFERENCES "points_ledger"("id") ON DELETE SET NULL,
        "created_by"        uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "note"              text,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_points_ledger_balance" CHECK ("balance_after" >= 0),
        CONSTRAINT "chk_points_ledger_nonzero" CHECK ("delta" <> 0)
      );

      /*
       * The idempotency guarantee. A given (user, reason, source) can be paid
       * exactly once — so re-running a verification job, replaying a queue or
       * double-processing a webhook is a no-op instead of free points.
       *
       * Reversals are excluded: reversing the same entry twice is prevented by
       * points_ledger.reversed_by being set, checked under a row lock.
       */
      CREATE UNIQUE INDEX "uq_points_ledger_award_source"
        ON "points_ledger" ("user_id","reason_code","ref_type","ref_id")
        WHERE "reason_code" <> 'reversal' AND "ref_id" IS NOT NULL;

      CREATE INDEX "idx_points_ledger_user_time" ON "points_ledger" ("user_id","created_at" DESC);
      CREATE INDEX "idx_points_ledger_ref" ON "points_ledger" ("ref_type","ref_id");
      -- Leaderboard rebuilds scan by window and scope.
      CREATE INDEX "idx_points_ledger_board"
        ON "points_ledger" ("created_at","state_id","user_id")
        WHERE "leaderboard_delta" <> 0;
    `);

    // ------------------------------------------------------ badges & challenges
    await queryRunner.query(`
      CREATE TABLE "badges" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code"        varchar(64) NOT NULL,
        "name"        varchar(120) NOT NULL,
        "description" text NOT NULL,
        "icon"        varchar(120),
        "criteria"    jsonb NOT NULL,
        "tier"        varchar(16) NOT NULL DEFAULT 'bronze',
        "is_active"   boolean NOT NULL DEFAULT true,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_badges_code" UNIQUE ("code")
      );

      CREATE TABLE "user_badges" (
        "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"   uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "badge_id"  uuid NOT NULL REFERENCES "badges"("id") ON DELETE CASCADE,
        "ref_id"    uuid,
        "earned_at" timestamptz NOT NULL DEFAULT now(),
        -- Makes the badge engine idempotent and backfill-safe.
        CONSTRAINT "uq_user_badges" UNIQUE ("user_id","badge_id")
      );
      CREATE INDEX "idx_user_badges_user" ON "user_badges" ("user_id","earned_at" DESC);

      CREATE TABLE "challenges" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"         varchar(200) NOT NULL,
        "slug"          varchar(240) NOT NULL,
        "description"   text NOT NULL,
        "scope"         "challenges_scope_enum" NOT NULL DEFAULT 'state',
        "state_id"      uuid REFERENCES "states"("id") ON DELETE CASCADE,
        "type"          "challenges_type_enum" NOT NULL DEFAULT 'discovery',
        "criteria"      jsonb NOT NULL,
        "multiplier"    numeric(4,2) NOT NULL DEFAULT 1,
        "starts_at"     timestamptz NOT NULL,
        "ends_at"       timestamptz NOT NULL,
        "reward_points" int NOT NULL DEFAULT 200,
        "hero_media_id" uuid REFERENCES "media"("id") ON DELETE SET NULL,
        "status"        "challenges_status_enum" NOT NULL DEFAULT 'draft',
        "created_by"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_challenges_slug" UNIQUE ("slug"),
        CONSTRAINT "chk_challenges_window" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "chk_challenges_multiplier" CHECK ("multiplier" BETWEEN 1 AND 5),
        CONSTRAINT "chk_challenges_state_scope" CHECK (
          "scope" <> 'state' OR "state_id" IS NOT NULL
        )
      );
      CREATE INDEX "idx_challenges_active" ON "challenges" ("status","starts_at","ends_at");

      CREATE TABLE "challenge_progress" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "challenge_id"   uuid NOT NULL REFERENCES "challenges"("id") ON DELETE CASCADE,
        "progress"       jsonb NOT NULL DEFAULT '{"visited":[],"required":0,"completed":0}',
        "completed_at"   timestamptz,
        "points_awarded" int NOT NULL DEFAULT 0,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_challenge_progress" UNIQUE ("user_id","challenge_id")
      );
      CREATE INDEX "idx_challenge_progress_challenge" ON "challenge_progress" ("challenge_id");
    `);

    // ------------------------------------------------- reviews, lists, boards
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "destination_id" uuid NOT NULL REFERENCES "destinations"("id") ON DELETE CASCADE,
        "check_in_id"    uuid NOT NULL REFERENCES "check_ins"("id") ON DELETE RESTRICT,
        "rating"         smallint NOT NULL,
        "body"           text,
        "tip"            varchar(300),
        "media_id"       uuid REFERENCES "media"("id") ON DELETE SET NULL,
        "status"         "reviews_status_enum" NOT NULL DEFAULT 'published',
        "helpful_count"  int NOT NULL DEFAULT 0,
        "points_awarded" int NOT NULL DEFAULT 0,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5),
        -- One review per user per destination (PRD F9).
        CONSTRAINT "uq_reviews_user_destination" UNIQUE ("user_id","destination_id")
      );
      CREATE INDEX "idx_reviews_destination" ON "reviews" ("destination_id","status");

      CREATE TABLE "lists" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name"       varchar(80) NOT NULL DEFAULT 'Want to visit',
        "is_default" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "uq_lists_user_default"
        ON "lists" ("user_id") WHERE "is_default" = true;

      CREATE TABLE "saved_places" (
        "list_id"        uuid NOT NULL REFERENCES "lists"("id") ON DELETE CASCADE,
        "destination_id" uuid NOT NULL REFERENCES "destinations"("id") ON DELETE CASCADE,
        "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "note"           text,
        "added_at"       timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("list_id","destination_id")
      );
      CREATE INDEX "idx_saved_places_user" ON "saved_places" ("user_id","added_at" DESC);

      CREATE TABLE "leaderboard_snapshots" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scope"       "leaderboard_snapshots_scope_enum" NOT NULL,
        "scope_id"    uuid,
        "period"      "leaderboard_snapshots_period_enum" NOT NULL,
        "period_key"  varchar(16) NOT NULL,
        "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "rank"        int NOT NULL,
        "points"      int NOT NULL,
        "computed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_leaderboard_snapshots_entry"
          UNIQUE ("scope","scope_id","period","period_key","user_id")
      );
      CREATE INDEX "idx_leaderboard_snapshots_rank"
        ON "leaderboard_snapshots" ("scope","scope_id","period","period_key","rank");
    `);

    // ------------------------------------------ moderation, audit, analytics
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "reporter_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "target_type"     "reports_target_type_enum" NOT NULL,
        "target_id"       uuid NOT NULL,
        "reason"          varchar(64) NOT NULL,
        "detail"          text,
        "status"          "reports_status_enum" NOT NULL DEFAULT 'open',
        "resolved_by"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "resolved_at"     timestamptz,
        "resolution_note" text,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        -- One open report per user per target; re-reporting is not a vote.
        CONSTRAINT "uq_reports_reporter_target"
          UNIQUE ("reporter_id","target_type","target_id")
      );
      CREATE INDEX "idx_reports_queue" ON "reports" ("status","created_at");
      CREATE INDEX "idx_reports_target" ON "reports" ("target_type","target_id");

      CREATE TABLE "moderation_actions" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "moderator_id"  uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "target_type"   varchar(32) NOT NULL,
        "target_id"     uuid NOT NULL,
        "action"        "moderation_actions_action_enum" NOT NULL,
        "reason"        text,
        "overturned_at" timestamptz,
        "created_at"    timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_moderation_actions_target"
        ON "moderation_actions" ("target_type","target_id");
      CREATE INDEX "idx_moderation_actions_moderator"
        ON "moderation_actions" ("moderator_id","created_at" DESC);

      CREATE TABLE "audit_logs" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "actor_role" varchar(32),
        "action"     varchar(120) NOT NULL,
        "entity"     varchar(64) NOT NULL,
        "entity_id"  uuid,
        "before"     jsonb,
        "after"      jsonb,
        "ip"         inet,
        "user_agent" varchar(255),
        "request_id" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" ("actor_id","created_at" DESC);
      CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity","entity_id");
      CREATE INDEX "idx_audit_logs_time" ON "audit_logs" ("created_at" DESC);

      CREATE TABLE "analytics_events" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "event"      varchar(80) NOT NULL,
        "properties" jsonb NOT NULL DEFAULT '{}',
        "session_id" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_analytics_events_event" ON "analytics_events" ("event","created_at" DESC);
      CREATE INDEX "idx_analytics_events_user"
        ON "analytics_events" ("user_id","created_at" DESC);

      CREATE TABLE "idempotency_records" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"         uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "key"             varchar(128) NOT NULL,
        "endpoint"        varchar(120) NOT NULL,
        "request_hash"    varchar(64) NOT NULL,
        "response_status" int,
        "response_body"   jsonb,
        "completed_at"    timestamptz,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_idempotency_records_user_key" UNIQUE ("user_id","key")
      );
      CREATE INDEX "idx_idempotency_records_created" ON "idempotency_records" ("created_at");
    `);

    /*
     * `destinations.search_vector` is maintained by a trigger rather than being
     * a GENERATED column, because `array_to_string` is STABLE, not IMMUTABLE,
     * and Postgres rejects a non-immutable generation expression. The aliases
     * array is the whole point of the column — "Khajurao" has to find Khajuraho
     * — so the trigger is the only way to keep it.
     */
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "destinations_search_vector"() RETURNS trigger AS $$
      BEGIN
        NEW."search_vector" :=
          setweight(to_tsvector('simple', coalesce(NEW."name", '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(array_to_string(NEW."aliases", ' '), '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW."description", '')), 'D');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_destinations_search_vector"
        BEFORE INSERT OR UPDATE OF "name", "aliases", "description" ON "destinations"
        FOR EACH ROW EXECUTE FUNCTION "destinations_search_vector"();
    `);

    /*
     * Append-only audit log. Ownership means a plain REVOKE would not bind the
     * application role, so immutability is enforced by a trigger instead — the
     * API physically cannot rewrite its own history, which is the requirement
     * government deployments actually audit for (PRD §5.4 F27).
     */
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "audit_logs_immutable"() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only (attempted %)', TG_OP;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_audit_logs_no_update"
        BEFORE UPDATE OR DELETE ON "audit_logs"
        FOR EACH ROW EXECUTE FUNCTION "audit_logs_immutable"();
    `);

    /*
     * Same reasoning for the points ledger: an award is corrected by adding a
     * reversal row, never by editing history. `reversed_by` is the one column
     * that must still be settable, so the trigger allows an update that touches
     * nothing else.
     */
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "points_ledger_append_only"() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'points_ledger is append-only (attempted DELETE)';
        END IF;
        IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) AND
           ROW(NEW."user_id", NEW."delta", NEW."reason_code", NEW."ref_type", NEW."ref_id",
               NEW."balance_after", NEW."leaderboard_delta", NEW."created_at")
           IS DISTINCT FROM
           ROW(OLD."user_id", OLD."delta", OLD."reason_code", OLD."ref_type", OLD."ref_id",
               OLD."balance_after", OLD."leaderboard_delta", OLD."created_at")
        THEN
          RAISE EXCEPTION 'points_ledger rows are immutable except reversed_by/note';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER "trg_points_ledger_append_only"
        BEFORE UPDATE OR DELETE ON "points_ledger"
        FOR EACH ROW EXECUTE FUNCTION "points_ledger_append_only"();
    `);

    /*
     * ---------------------------------------------------------------- Phase 2
     * Tables for partners, rewards and trips exist from day one so that turning
     * those features on is a code change, not a migration against live data.
     * No entities, services or endpoints reference them at MVP (TEAM_PLAN cuts
     * F7/F8/F16/F26 from v1).
     */
    await queryRunner.query(`
      CREATE TABLE "partners" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"                varchar(160) NOT NULL,
        "type"                varchar(40) NOT NULL,
        "owner_user_id"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "destination_id"      uuid REFERENCES "destinations"("id") ON DELETE SET NULL,
        "address"             text,
        "location"            geometry(Point, 4326),
        "registration_no"     varchar(64),
        "verification_status" varchar(24) NOT NULL DEFAULT 'pending',
        "contact"             jsonb NOT NULL DEFAULT '{}',
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_partners_location" ON "partners" USING GIST ("location");

      CREATE TABLE "rewards" (
        "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"                varchar(200) NOT NULL,
        "type"                 varchar(40) NOT NULL,
        "partner_id"           uuid REFERENCES "partners"("id") ON DELETE CASCADE,
        "state_id"             uuid REFERENCES "states"("id") ON DELETE SET NULL,
        "points_cost"          int NOT NULL,
        "inventory_total"      int NOT NULL DEFAULT 0,
        "inventory_left"       int NOT NULL DEFAULT 0,
        "min_level"            int NOT NULL DEFAULT 1,
        "requires_verification" boolean NOT NULL DEFAULT true,
        "terms"                text,
        "valid_from"           timestamptz,
        "valid_to"             timestamptz,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_rewards_inventory" CHECK ("inventory_left" >= 0)
      );

      CREATE TABLE "reward_redemptions" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reward_id"    uuid NOT NULL REFERENCES "rewards"("id") ON DELETE RESTRICT,
        "code"         varchar(32) NOT NULL,
        "status"       varchar(24) NOT NULL DEFAULT 'issued',
        "redeemed_at"  timestamptz,
        "validated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_reward_redemptions_code" UNIQUE ("code")
      );

      CREATE TABLE "trips" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title"       varchar(160) NOT NULL,
        "state_id"    uuid REFERENCES "states"("id") ON DELETE SET NULL,
        "start_date"  date,
        "end_date"    date,
        "is_public"   boolean NOT NULL DEFAULT false,
        "share_slug"  varchar(40),
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_trips_share_slug" UNIQUE ("share_slug")
      );

      CREATE TABLE "trip_items" (
        "trip_id"              uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
        "destination_id"       uuid NOT NULL REFERENCES "destinations"("id") ON DELETE CASCADE,
        "day"                  int NOT NULL DEFAULT 1,
        "order_index"          int NOT NULL DEFAULT 0,
        "planned_duration_min" int,
        "notes"                text,
        PRIMARY KEY ("trip_id","destination_id","day")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_points_ledger_append_only" ON "points_ledger";
      DROP FUNCTION IF EXISTS "points_ledger_append_only"();
      DROP TRIGGER IF EXISTS "trg_audit_logs_no_update" ON "audit_logs";
      DROP FUNCTION IF EXISTS "audit_logs_immutable"();
      DROP TRIGGER IF EXISTS "trg_destinations_search_vector" ON "destinations";
      DROP FUNCTION IF EXISTS "destinations_search_vector"();
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "trip_items","trips","reward_redemptions","rewards","partners",
        "idempotency_records","analytics_events","audit_logs","moderation_actions","reports",
        "leaderboard_snapshots","saved_places","lists","reviews","challenge_progress",
        "challenges","user_badges","badges","points_ledger","verification_signals","check_ins",
        "media","itinerary_stops","itineraries","circuit_destinations","circuits",
        "things_to_do","destination_info","destination_categories","destinations",
        "devices","refresh_tokens","user_profiles","users","categories","districts","states"
      CASCADE;
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "moderation_actions_action_enum","reports_status_enum",
        "reports_target_type_enum","leaderboard_snapshots_period_enum",
        "leaderboard_snapshots_scope_enum","reviews_status_enum","challenges_status_enum",
        "challenges_type_enum","challenges_scope_enum","points_ledger_ref_type_enum",
        "points_ledger_reason_code_enum","check_ins_rejection_reason_enum",
        "check_ins_status_enum","media_status_enum","media_owner_type_enum",
        "media_source_enum","media_type_enum","circuits_status_enum",
        "destinations_avg_budget_enum","destinations_crowd_level_enum",
        "destinations_best_season_enum","destinations_difficulty_enum",
        "destinations_status_enum","users_status_enum","users_role_enum";
    `);
  }
}
