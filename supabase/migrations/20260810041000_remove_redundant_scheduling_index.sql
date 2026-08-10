-- The database already had an equivalent provider/time uniqueness index.
-- Remove the duplicate introduced by the previous hardening migration.
DROP INDEX IF EXISTS public.uq_service_requests_provider_scheduled_at_active;
