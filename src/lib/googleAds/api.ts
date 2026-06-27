const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const REST              = `${SUPABASE_URL}/rest/v1`;
const REST_HEADERS      = {
  apikey:          SUPABASE_ANON_KEY,
  Authorization:   `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type':  'application/json',
};

// ─── Campaign mappings (Supabase) ─────────────────────────────────────────────

export interface CampaignMapping {
  id?:                   string;
  voluum_campaign_name:  string;
  gads_campaign_name:    string;
}

export async function loadCampaignMappings(): Promise<CampaignMapping[]> {
  const res = await fetch(`${REST}/campaign_mappings?order=created_at.asc`, { headers: REST_HEADERS });
  if (!res.ok) throw new Error(`Load mappings: ${await res.text()}`);
  return res.json() as Promise<CampaignMapping[]>;
}

export async function saveCampaignMapping(m: Omit<CampaignMapping, 'id'>): Promise<void> {
  const res = await fetch(`${REST}/campaign_mappings`, {
    method: 'POST',
    headers: { ...REST_HEADERS, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(m),
  });
  if (!res.ok) throw new Error(`Save mapping: ${await res.text()}`);
}

export async function deleteCampaignMapping(id: string): Promise<void> {
  const res = await fetch(`${REST}/campaign_mappings?id=eq.${id}`, {
    method: 'DELETE',
    headers: REST_HEADERS,
  });
  if (!res.ok) throw new Error(`Delete mapping: ${await res.text()}`);
}
