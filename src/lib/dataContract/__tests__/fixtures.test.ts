import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../csv/parser';
import { SHEET_TABS } from '../../googleSheets';
import { REQUIRED_COLUMNS } from '../../csv/validator';
import {
  CONTRACT_TAB_NAMES,
  getCurrentImportTabs,
  validateTabHeaders,
  validateTabRow,
} from '../contract';
import { SAMPLE_ROWS, sampleRowToCSV } from '../samples';

describe('data contract sample fixtures', () => {
  it('has a sample row for every canonical tab', () => {
    expect(Object.keys(SAMPLE_ROWS).sort()).toEqual([...CONTRACT_TAB_NAMES].sort());
  });

  it('round-trips every sample row through the CSV parser and typed validators', async () => {
    for (const tabName of CONTRACT_TAB_NAMES) {
      const csv = sampleRowToCSV(tabName);
      const parsed = await parseCSV(csv);

      expect(parsed).toHaveLength(1);
      expect(validateTabHeaders(tabName, Object.keys(parsed[0]))).toEqual({
        valid: true,
        missingColumns: [],
        extraColumns: [],
        presentColumns: Object.keys(parsed[0]),
      });
      expect(validateTabRow(tabName, parsed[0])).toEqual({ valid: true, errors: [] });
    }
  });

  it('keeps existing import tabs wired to the canonical contract', () => {
    expect(SHEET_TABS.map((tab) => tab.tabName)).toEqual(
      getCurrentImportTabs().map((tab) => tab.tabName)
    );

    for (const tab of getCurrentImportTabs()) {
      expect(REQUIRED_COLUMNS[tab.key]).toEqual(tab.requiredColumns);
    }
  });
});
