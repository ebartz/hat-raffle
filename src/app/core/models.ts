export interface ScanRecord {
  code: string;
  /** Sequential participant number, starting at 1. */
  number: number;
  winner: boolean;
  station?: string;
  timestamp: string;
}

export type ScanStatus = 'new' | 'duplicate';

export interface ScanResult {
  status: ScanStatus;
  record: ScanRecord;
  /** True when the participant would have won but all hats are gone. */
  soldOut: boolean;
}

export interface ScanStats {
  total: number;
  winners: number;
}

export interface RegisterOptions {
  rule: 'counter' | 'code' | 'random';
  hatsTotal: number;
  hatsPer100: number;
  station: string;
}

/** A new scan at any station, pushed live by the backend (without the badge code). */
export interface RemoteScanEvent {
  status: ScanStatus;
  soldOut: boolean;
  record: Omit<ScanRecord, 'code'>;
  /** Id of the browser that made the scan, used to skip our own scans. */
  clientId: string;
  stats: ScanStats;
}
