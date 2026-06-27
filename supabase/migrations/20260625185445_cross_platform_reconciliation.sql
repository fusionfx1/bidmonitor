-- API credentials for external platforms (Google Ads, Voluum UI config)
CREATE TABLE api_credentials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform   text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_api_credentials" ON api_credentials
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_api_credentials" ON api_credentials
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_api_credentials" ON api_credentials
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_api_credentials" ON api_credentials
  FOR DELETE TO anon, authenticated USING (true);

-- Cached reconciled reports
CREATE TABLE reconciled_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_from  date NOT NULL,
  date_to    date NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reconciled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_reconciled_reports" ON reconciled_reports
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_reconciled_reports" ON reconciled_reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_reconciled_reports" ON reconciled_reports
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_reconciled_reports" ON reconciled_reports
  FOR DELETE TO anon, authenticated USING (true);

-- Manual campaign name mappings between platforms
CREATE TABLE campaign_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voluum_campaign_name  text NOT NULL,
  gads_campaign_name    text NOT NULL,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (voluum_campaign_name, gads_campaign_name)
);

ALTER TABLE campaign_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_campaign_mappings" ON campaign_mappings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_campaign_mappings" ON campaign_mappings
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_campaign_mappings" ON campaign_mappings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_campaign_mappings" ON campaign_mappings
  FOR DELETE TO anon, authenticated USING (true);
