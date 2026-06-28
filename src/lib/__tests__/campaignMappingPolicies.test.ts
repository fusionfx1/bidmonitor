import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationsDir = new URL('../../../supabase/migrations/', import.meta.url);

function readOrderedMigrationSql(): string {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'))
    .join('\n');
}

function lastMatchIndex(sql: string, pattern: RegExp): number {
  const matches = Array.from(sql.matchAll(pattern));
  return matches.length > 0 ? matches[matches.length - 1].index ?? -1 : -1;
}

describe('campaign mapping database policies', () => {
  it('removes public REST write policies after the original campaign_mappings grants', () => {
    const sql = readOrderedMigrationSql();

    for (const policyName of ['insert_campaign_mappings', 'update_campaign_mappings', 'delete_campaign_mappings']) {
      const createPolicyIndex = lastMatchIndex(
        sql,
        new RegExp(`CREATE\\s+POLICY\\s+"${policyName}"\\s+ON\\s+(?:public\\.)?campaign_mappings`, 'gi')
      );
      const dropPolicyIndex = lastMatchIndex(
        sql,
        new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${policyName}"\\s+ON\\s+(?:public\\.)?campaign_mappings`, 'gi')
      );

      expect(createPolicyIndex).toBeGreaterThanOrEqual(0);
      expect(dropPolicyIndex).toBeGreaterThan(createPolicyIndex);
    }

    expect(sql).toMatch(
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.campaign_mappings\s+FROM\s+anon,\s*authenticated/iu
    );
  });
});
