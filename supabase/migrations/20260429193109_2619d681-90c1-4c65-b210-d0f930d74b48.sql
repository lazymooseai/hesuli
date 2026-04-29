
CREATE TABLE public.political_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_key TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  category TEXT NOT NULL DEFAULT 'politiikka',
  vip_level TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  predicted_end_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  end_error_min INTEGER,
  source_url TEXT,
  source TEXT NOT NULL DEFAULT 'gemini-search',
  confidence NUMERIC,
  reasoning TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.political_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view political_events" ON public.political_events FOR SELECT USING (true);
CREATE POLICY "Anyone can insert political_events" ON public.political_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update political_events" ON public.political_events FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete political_events" ON public.political_events FOR DELETE USING (true);

CREATE INDEX idx_political_events_start ON public.political_events(start_time);
CREATE INDEX idx_political_events_external_key ON public.political_events(external_key);

CREATE TRIGGER update_political_events_updated_at
  BEFORE UPDATE ON public.political_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
