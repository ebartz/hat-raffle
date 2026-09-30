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
  rule: 'counter' | 'code';
  hatsTotal: number;
  station: string;
}
