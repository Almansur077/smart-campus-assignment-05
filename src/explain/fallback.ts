// Deterministic explanation text per reason code. Used as the safe fallback and as the body of the mock adapter.
// Every text is at most two sentences and only uses values from the facts (checked by tests via validateExplanation).
import type { ExplainFacts } from './types';

function span(facts: ExplainFacts): string {
  const { startText, endText } = facts.request;
  return startText !== null && endText !== null ? `from ${startText} to ${endText}` : 'for the requested time';
}

export function fallbackExplanation(facts: ExplainFacts): string {
  const { request, now, maxMinutes } = facts;
  switch (facts.reasonCode) {
    case 'INVALID_NUMBER':
      return 'Start and end must be whole numbers of minutes, so this request cannot be checked.';
    case 'OUT_OF_DAY':
      return 'The requested times must stay within one day, from 0 to 1440 minutes.';
    case 'SAME_TIME':
      return `Start and end are the same time (${request.startText}), so the request has no length and cannot be checked.`;
    case 'REVERSED':
      return `The end time ${request.endText} is earlier than the start time ${request.startText}, so the interval is not valid.`;
    case 'PAST_TIME':
      return `The start time ${request.startText} is not later than the current demo time ${now.text}, so it cannot be booked.`;
    case 'TOO_LONG':
      return `This request is ${facts.durationMinutes} minutes, which is longer than the ${maxMinutes}-minute limit.`;
    case 'ROOM_BLOCKED':
      return `Room ${facts.roomLabel} is blocked in this demo, so it cannot be used ${span(facts)}.`;
    case 'OVERLAP':
      return `The request ${span(facts)} overlaps an existing booking from ${facts.conflict?.startText} to ${facts.conflict?.endText}, so the room is unavailable.`;
    case 'AVAILABLE':
      return `Room ${facts.roomLabel} is available ${span(facts)}. The request starts after the current demo time and stays within the ${maxMinutes}-minute limit.`;
  }
}
