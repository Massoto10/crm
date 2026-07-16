-- Instagram channel removed: the integration was never more than a stub.
-- Aborts instead of destroying data if any row still references the value.
DO $$
DECLARE
  offending INTEGER;
BEGIN
  SELECT
    (SELECT count(*) FROM "conversations" WHERE "channel_type" = 'instagram')
    + (SELECT count(*) FROM "end_customers" WHERE "origin_channel" = 'instagram')
    + (SELECT count(*) FROM "client_channels" WHERE "channel_type" = 'instagram')
  INTO offending;
  IF offending > 0 THEN
    RAISE EXCEPTION 'Abortado: % linha(s) ainda usam ChannelType instagram; migre-as antes.', offending;
  END IF;
END $$;

ALTER TABLE "end_customers" DROP COLUMN "instagram_handle";

-- Postgres cannot drop a value from an enum; the type has to be rebuilt.
ALTER TYPE "ChannelType" RENAME TO "ChannelType_old";
CREATE TYPE "ChannelType" AS ENUM ('whatsapp', 'email', 'site', 'manual');

ALTER TABLE "conversations" ALTER COLUMN "channel_type" TYPE "ChannelType" USING "channel_type"::text::"ChannelType";
ALTER TABLE "end_customers" ALTER COLUMN "origin_channel" TYPE "ChannelType" USING "origin_channel"::text::"ChannelType";
ALTER TABLE "client_channels" ALTER COLUMN "channel_type" TYPE "ChannelType" USING "channel_type"::text::"ChannelType";

DROP TYPE "ChannelType_old";
