import { describe, expect, it } from 'vitest';
import { ScanRecord } from '../core/models';
import { buildScansPdf } from './scans-pdf';

const scan = (number: number, winner = false): ScanRecord => ({
  number,
  code: `BADGE-${number}-` + 'x'.repeat(number % 3 ? 10 : 120),
  winner,
  station: 'Booth A',
  timestamp: '2026-10-27T10:00:00.000Z',
});

describe('buildScansPdf', () => {
  it('adds one QR image per scan and spreads rows over several pages', async () => {
    const scans = Array.from({ length: 25 }, (_, i) => scan(i + 1, i % 5 === 1));
    const doc = await buildScansPdf(scans, 'https://raffle.example.com');
    const pdf = doc.output();
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.match(/\/Subtype \/Image/g)?.length).toBe(25);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('works without scans', async () => {
    const doc = await buildScansPdf([], 'local');
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
