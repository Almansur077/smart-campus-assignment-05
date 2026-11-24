// Assignment #05 Task 03: unit tests for the extracted parser (UI behavior stays covered by U01-U13 and P01-P04).
import { describe, expect, it } from 'vitest';
import { parseMinute, parseRequest } from './parseInput';

describe('parseRequest (moved from App.tsx)', () => {
  it('Q01 empty start -> "Start is required." (start checked first)', () => {
    expect(parseRequest('', '')).toEqual({ ok: false, field: 'start', message: 'Start is required.' });
    expect(parseRequest('   ', '660')).toEqual({ ok: false, field: 'start', message: 'Start is required.' });
  });
  it('Q02 empty end -> "End is required."', () => {
    expect(parseRequest('660', ' ')).toEqual({ ok: false, field: 'end', message: 'End is required.' });
  });
  it('Q03 whole numbers pass through', () => {
    expect(parseRequest('660', '720')).toEqual({ ok: true, start: 660, end: 720 });
  });
  it('Q04 decimals and exponents are kept, not truncated (R-01)', () => {
    expect(parseRequest('600.5', '7e2')).toEqual({ ok: true, start: 600.5, end: 700 });
  });
  it('Q05 non-numeric text -> null (the rule then reports INVALID_NUMBER)', () => {
    expect(parseMinute('abc')).toBeNull();
    expect(parseRequest('abc', '660')).toEqual({ ok: true, start: null, end: 660 });
  });
});
