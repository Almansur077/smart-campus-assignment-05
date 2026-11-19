import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  CalendarClock,
  CircleCheck,
  CircleX,
  Clock,
  DoorClosed,
  Info,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  evaluateAvailability,
  formatTime,
  MAX_MINUTES,
  type DetailedResult,
  type Result,
  type RoomState,
} from './domain/availability';
import { DEMO_ROOM } from './data/demoRoom';
import { requestExplanation } from './explain/client';
import { MAX_QUESTION_LENGTH, type ExplainResponse } from './explain/types';

type Checked = { start: number | null; end: number | null; blocked: boolean; detail: DetailedResult };

const SOURCE_BADGE = {
  mock: { label: 'Mock', className: 'bg-amber-100 text-amber-900 ring-amber-300' },
  llm: { label: 'LLM', className: 'bg-indigo-100 text-indigo-900 ring-indigo-300' },
  fallback: { label: 'Fallback', className: 'bg-slate-200 text-slate-800 ring-slate-300' },
} as const;

function validateRequired(start: string, end: string): { field: 'start' | 'end'; message: string } | null {
  if (start.trim() === '') return { field: 'start', message: 'Start is required.' };
  if (end.trim() === '') return { field: 'end', message: 'End is required.' };
  return null;
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
      <span className="mt-0.5 text-teal-300">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-300">{label}</div>
        <div className="break-words text-sm text-white">{value}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [room] = useState<RoomState>(() => ({
    now: DEMO_ROOM.now,
    blocked: DEMO_ROOM.blocked,
    bookings: DEMO_ROOM.bookings.map((b) => ({ ...b })),
  }));
  const [startText, setStartText] = useState('660');
  const [endText, setEndText] = useState('720');
  const [blocked, setBlocked] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  // Practice #11 (optional explanation). The checker result above stays the only source of truth.
  const [checked, setChecked] = useState<Checked | null>(null);
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [explaining, setExplaining] = useState(false);
  const explainRequestId = useRef(0);

  function clearExplanation() {
    explainRequestId.current += 1; // ignore any answer still in flight
    setExplanation(null);
    setExplaining(false);
  }

  async function handleExplain() {
    if (!checked) return;
    const id = ++explainRequestId.current;
    setExplaining(true);
    setExplanation(null);
    const response = await requestExplanation({ room, ...checked, question });
    if (id !== explainRequestId.current) return;
    setExplanation(response);
    setExplaining(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    clearExplanation();
    const missing = validateRequired(startText, endText);
    if (missing) {
      setResult({ available: false, message: missing.message });
      setChecked(null);
      return;
    }
    const parsedStart = Number(startText);
    const parsedEnd = Number(endText);
    const start = Number.isNaN(parsedStart) ? null : parsedStart;
    const end = Number.isNaN(parsedEnd) ? null : parsedEnd;
    const detail = evaluateAvailability({ ...room, blocked }, start, end);
    setResult({ available: detail.available, message: detail.message });
    setChecked({ start, end, blocked, detail });
  }

  const bookingList = room.bookings
    .map((b) => `${b.start}–${b.end} (${formatTime(b.start)}–${formatTime(b.end)})`)
    .join(', ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1f44] via-[#0b2447] to-[#0a1f44] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-500/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-300 ring-1 ring-teal-400/30">
            <DoorClosed className="h-4 w-4" />
            Smart Campus
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Room Availability Checker</h1>
          <p className="mt-2 text-sm text-slate-300">Room B-204 — check only, no booking created.</p>
        </header>

        <section className="mb-6 rounded-2xl bg-[#0e2a57] p-5 ring-1 ring-white/10 shadow-xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-300">Room info</h2>
          <div className="space-y-2">
            <InfoRow icon={<DoorClosed className="h-4 w-4" />} label="Room" value="B-204" />
            <InfoRow
              icon={<Clock className="h-4 w-4" />}
              label="Current demo time"
              value={`${room.now} min = ${formatTime(room.now)}`}
            />
            <InfoRow icon={<CalendarClock className="h-4 w-4" />} label="Existing bookings" value={bookingList || 'None'} />
          </div>
        </section>

        <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl bg-white p-5 text-slate-900 shadow-xl sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="start" className="mb-1 block text-sm font-semibold text-slate-800">
                Start (minutes after midnight)
              </label>
              <input
                id="start"
                name="start"
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                value={startText}
                onChange={(e) => {
                  setStartText(e.target.value);
                  clearExplanation();
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/40"
              />
            </div>
            <div>
              <label htmlFor="end" className="mb-1 block text-sm font-semibold text-slate-800">
                End (minutes after midnight)
              </label>
              <input
                id="end"
                name="end"
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                value={endText}
                onChange={(e) => {
                  setEndText(e.target.value);
                  clearExplanation();
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/40"
              />
            </div>
          </div>

          <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            Reference: <strong>660</strong> = 11:00, <strong>720</strong> = 12:00, <strong>1440</strong> = 24:00. Maximum
            length is {MAX_MINUTES} minutes.
          </p>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={blocked}
              onChange={(e) => {
                setBlocked(e.target.checked);
                clearExplanation();
              }}
              className="h-4 w-4 rounded border-slate-400 text-teal-600 focus:ring-2 focus:ring-teal-600/50"
            />
            Room blocked (demo)
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 focus:ring-offset-white"
          >
            Check availability
          </button>

          <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <Info className="h-3.5 w-3.5" />
            Availability check only. No booking is created.
          </p>

          {result && (
            <div
              role="status"
              aria-live="polite"
              className={`mt-1 flex items-start gap-3 rounded-xl p-4 ring-1 ${
                result.available ? 'bg-emerald-50 ring-emerald-200 text-emerald-900' : 'bg-rose-50 ring-rose-200 text-rose-900'
              }`}
            >
              {result.available ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              )}
              <div>
                <div className="text-sm font-bold uppercase tracking-wide">{result.available ? 'Available' : 'Unavailable'}</div>
                <div className="mt-0.5 text-sm">{result.message}</div>
              </div>
            </div>
          )}
        </form>

        {checked && (
          <section aria-label="Explain availability" className="mt-6 space-y-3 rounded-2xl bg-white p-5 text-slate-900 shadow-xl sm:p-6">
            <div>
              <label htmlFor="explain-question" className="mb-1 block text-sm font-semibold text-slate-800">
                Question (optional, max {MAX_QUESTION_LENGTH} characters)
              </label>
              <input
                id="explain-question"
                name="explain-question"
                type="text"
                maxLength={MAX_QUESTION_LENGTH}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/40"
              />
            </div>
            <button
              type="button"
              onClick={handleExplain}
              disabled={explaining}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-600 bg-white px-4 py-3 text-base font-semibold text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {explaining ? 'Explaining…' : 'Explain availability'}
            </button>

            {explanation && (
              <div
                data-testid="explanation-panel"
                className="rounded-xl border border-dashed border-slate-400 bg-slate-50 p-4 text-slate-800"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    AI-generated explanation - not a booking decision
                  </div>
                  <span
                    data-testid="explanation-source"
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${SOURCE_BADGE[explanation.source].className}`}
                  >
                    {SOURCE_BADGE[explanation.source].label}
                  </span>
                </div>
                <p className="text-sm">{explanation.explanation}</p>
                {explanation.source === 'mock' && (
                  <p className="mt-2 text-xs text-slate-600">Mock adapter: fixed demo text, no AI model was called.</p>
                )}
                {explanation.notice && <p className="mt-2 text-xs text-slate-600">{explanation.notice}</p>}
              </div>
            )}
          </section>
        )}

        <footer className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <ShieldAlert className="h-3.5 w-3.5" />
          Local demo data only. No login, backend, or external APIs.
        </footer>
      </div>
    </div>
  );
}
