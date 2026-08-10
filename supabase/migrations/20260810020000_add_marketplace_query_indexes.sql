-- Performance indexes for common FixNow marketplace lookups.
-- Safe to re-run: IF NOT EXISTS prevents duplicates.

CREATE INDEX IF NOT EXISTS idx_service_requests_client_id
  ON public.service_requests (client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id
  ON public.service_requests (provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_id
  ON public.service_requests (service_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status
  ON public.service_requests (status);

CREATE INDEX IF NOT EXISTS idx_quotes_request_id
  ON public.quotes (request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_provider_id
  ON public.quotes (provider_id);

CREATE INDEX IF NOT EXISTS idx_messages_request_id
  ON public.messages (request_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_client_id
  ON public.reviews (client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id
  ON public.reviews (provider_id);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id
  ON public.addresses (user_id);

CREATE INDEX IF NOT EXISTS idx_provider_services_service_id
  ON public.provider_services (service_id);

CREATE INDEX IF NOT EXISTS idx_favorites_provider_id
  ON public.favorites (provider_id);
