CREATE TABLE IF NOT EXISTS public.demand_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key text NOT NULL,
  card_type text NOT NULL,
  card_label text,
  zone text,
  demand_level text NOT NULL CHECK (demand_level IN ('many','some','few','ended')),
  note text,
  reported_by_device text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_feedback_card_key ON public.demand_feedback (card_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_feedback_expires ON public.demand_feedback (expires_at);

ALTER TABLE public.demand_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view demand_feedback" ON public.demand_feedback FOR SELECT USING (true);
CREATE POLICY "Anyone can insert demand_feedback" ON public.demand_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete demand_feedback" ON public.demand_feedback FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.demand_feedback;