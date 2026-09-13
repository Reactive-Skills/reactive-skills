'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Radio,
  Send,
  Sliders,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { MermaidViewer } from '@/components/common/MermaidViewer';
import { cn } from '@/lib/utils';

export function LiveTelemetryDeck({ skill }) {
  const [bridgeUrl, setBridgeUrl] = useState('http://127.0.0.1:4242');
  const [status, setStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [activeState, setActiveState] = useState(skill.initialState || '');
  const [context, setContext] = useState({});
  const [events, setEvents] = useState([]);
  const [scrubIndex, setScrubIndex] = useState(null);
  const [signalInput, setSignalInput] = useState('');
  const [signalSending, setSignalSending] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState({});

  const eventSourceRef = useRef(null);

  const connectBridge = async () => {
    disconnectBridge();
    setStatus('connecting');
    setErrorMessage('');

    try {
      // First verify health/state endpoint
      const stateRes = await fetch(`${bridgeUrl}/state`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!stateRes.ok) {
        throw new Error(`Server returned HTTP ${stateRes.status}`);
      }

      const stateData = await stateRes.json();
      if (stateData.activeState) {
        setActiveState(stateData.activeState);
      }
      if (stateData.context) {
        setContext(stateData.context);
      }

      // Open SSE event stream
      const es = new EventSource(`${bridgeUrl}/events?sinceSeq=0`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('connected');
      };

      es.addEventListener('connected', (e) => {
        setStatus('connected');
      });

      es.addEventListener('signal_event', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setEvents((prev) => {
            const next = [...prev, parsed];
            return next.sort((a, b) => (a.seq || 0) - (b.seq || 0));
          });

          // Track state changes
          if (parsed.state) {
            setActiveState(parsed.state);
          } else if (parsed.payload?.to) {
            setActiveState(parsed.payload.to);
          } else if (parsed.payload?.to_state) {
            setActiveState(parsed.payload.to_state);
          }

          if (parsed.payload?.context) {
            setContext((prevCtx) => ({ ...prevCtx, ...parsed.payload.context }));
          }
        } catch (err) {
          console.error('Failed to parse incoming SSE message:', err);
        }
      });

      es.onerror = () => {
        if (status === 'connected') {
          setStatus('error');
          setErrorMessage('Event stream disconnected. Retrying...');
        } else {
          setStatus('error');
          setErrorMessage('Could not connect to telemetry bridge on ' + bridgeUrl);
        }
      };
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Connection failed');
    }
  };

  const disconnectBridge = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('disconnected');
    setScrubIndex(null);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleEmitSignal = async (e) => {
    e?.preventDefault();
    if (!signalInput.trim()) return;

    setSignalSending(true);
    try {
      const res = await fetch(`${bridgeUrl}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal: signalInput.trim() }),
      });
      if (res.ok) {
        setSignalInput('');
      } else {
        const json = await res.json();
        alert(`Signal failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Signal dispatch error: ${err.message}`);
    } finally {
      setSignalSending(false);
    }
  };

  // Determine current display state considering time-travel scrubber
  const displayedEvents = scrubIndex !== null ? events.slice(0, scrubIndex + 1) : events;
  const currentDisplayedState = (() => {
    if (scrubIndex !== null && displayedEvents.length > 0) {
      const last = displayedEvents[displayedEvents.length - 1];
      return last.state || last.payload?.to || last.payload?.to_state || activeState;
    }
    return activeState;
  })();

  const toggleEventExpand = (id) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Top Connection Bar */}
      <div className="rounded-xl border border-phino-border bg-phino-surface p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                status === 'connected' && 'bg-emerald-400 animate-pulse',
                status === 'connecting' && 'bg-amber-400 animate-ping',
                status === 'disconnected' && 'bg-zinc-500',
                status === 'error' && 'bg-rose-500',
              )}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-phino-text">
              {status === 'connected' && 'LIVE STREAM ACTIVE'}
              {status === 'connecting' && 'CONNECTING...'}
              {status === 'disconnected' && 'DISCONNECTED'}
              {status === 'error' && 'ERROR'}
            </span>
          </div>

          <div className="flex items-center rounded-lg border border-phino-border bg-phino-canvas px-2.5 py-1 text-xs">
            <Radio className="h-3.5 w-3.5 text-phino-text-muted mr-1.5" />
            <input
              type="text"
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              placeholder="http://127.0.0.1:4242"
              className="bg-transparent text-phino-text font-mono text-xs focus:outline-none w-48"
              disabled={status === 'connected' || status === 'connecting'}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <button
              type="button"
              onClick={disconnectBridge}
              className="inline-flex items-center gap-1.5 rounded-lg border border-phino-danger/30 bg-phino-danger-soft px-3 py-1.5 text-xs font-medium text-phino-danger-text hover:bg-phino-danger-soft/80"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={connectBridge}
              disabled={status === 'connecting'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-phino-signal px-3 py-1.5 text-xs font-semibold text-phino-canvas hover:opacity-90 transition-opacity"
            >
              <Play className="h-3.5 w-3.5" />
              Connect to Local Agent
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
          <span className="text-phino-text-muted ml-auto">Run `reactive-skills-axi view {skill.slug}` locally to start daemon.</span>
        </div>
      )}

      {/* Metrics & Active State Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-phino-border bg-phino-surface p-4">
          <div className="text-xs font-medium text-phino-text-muted">Active HSM State</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-phino-signal/40 bg-phino-signal-soft px-2.5 py-1 font-mono text-sm font-bold text-phino-signal-text">
              <span className="h-2 w-2 rounded-full bg-phino-signal animate-pulse" />
              {currentDisplayedState || 'NONE'}
            </span>
            {scrubIndex !== null && (
              <span className="text-2xs font-mono text-amber-400 border border-amber-400/30 bg-amber-950/20 px-1.5 py-0.5 rounded">
                PAUSED AT SEQ {displayedEvents[displayedEvents.length - 1]?.seq || 0}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-phino-border bg-phino-surface p-4">
          <div className="text-xs font-medium text-phino-text-muted">Recorded Events</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-phino-text">
            {events.length}
          </div>
        </div>

        <div className="rounded-xl border border-phino-border bg-phino-surface p-4">
          <div className="text-xs font-medium text-phino-text-muted">Latest Signal</div>
          <div className="mt-1.5 font-mono text-sm text-phino-text truncate">
            {events.length > 0 ? events[events.length - 1].type : '—'}
          </div>
        </div>
      </div>

      {/* Statechart with Live Dynamic Highlighting */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-phino-text-muted px-1">
          <span>Active state node pulses with teal border in real-time</span>
          <span className="font-mono text-2xs">State: {currentDisplayedState}</span>
        </div>
        <MermaidViewer
          chart={skill.mermaidChart}
          title={`${skill.name} (Live Statechart)`}
          activeState={currentDisplayedState}
        />
      </div>

      {/* Time-Travel Scrubber */}
      {events.length > 1 && (
        <div className="rounded-xl border border-phino-border bg-phino-surface p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-phino-text">
              <Sliders className="h-3.5 w-3.5 text-phino-signal" />
              <span>Event-Sourced Time-Travel Scrubber</span>
            </div>
            {scrubIndex !== null ? (
              <button
                type="button"
                onClick={() => setScrubIndex(null)}
                className="inline-flex items-center gap-1 text-2xs text-phino-signal hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Resume Live Stream
              </button>
            ) : (
              <span className="text-2xs text-phino-text-muted">Live Tracking</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max={events.length - 1}
              value={scrubIndex !== null ? scrubIndex : events.length - 1}
              onChange={(e) => setScrubIndex(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-phino-canvas rounded-lg appearance-none cursor-pointer accent-phino-signal"
            />
            <span className="font-mono text-xs text-phino-text-muted whitespace-nowrap">
              {scrubIndex !== null ? scrubIndex + 1 : events.length} / {events.length}
            </span>
          </div>
        </div>
      )}

      {/* Two Column Section: Live Event Stream Feed & HITL Signal Dispatcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Event Stream Feed */}
        <div className="lg:col-span-2 rounded-xl border border-phino-border bg-phino-surface p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-phino-border pb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-phino-text">
              <Activity className="h-3.5 w-3.5 text-phino-signal" />
              <span>Streaming Event Ledger</span>
            </div>
            <span className="font-mono text-2xs text-phino-text-muted">{displayedEvents.length} events</span>
          </div>

          <div className="divide-y divide-phino-border/40 max-h-80 overflow-y-auto font-mono text-xs">
            {displayedEvents.length === 0 ? (
              <div className="py-8 text-center text-phino-text-muted text-xs">
                No events received yet. Start an agent run with `reactive-skills-axi invoke {skill.slug}` to stream events.
              </div>
            ) : (
              [...displayedEvents].reverse().map((ev, idx) => {
                const isExpanded = expandedEvents[ev.id || idx];
                return (
                  <div key={ev.id || idx} className="py-2 px-1 hover:bg-phino-surface-raised/40 rounded transition-colors">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleEventExpand(ev.id || idx)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-phino-text-muted" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-phino-text-muted" />
                        )}
                        <span className="text-phino-text-subtle text-2xs">#{ev.seq}</span>
                        <span className="font-semibold text-phino-signal-text">{ev.type}</span>
                        {ev.state && (
                          <span className="text-2xs rounded bg-phino-canvas px-1.5 py-0.5 text-phino-text-muted">
                            [{ev.state}]
                          </span>
                        )}
                      </div>
                      <span className="text-2xs text-phino-text-subtle">
                        {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    {isExpanded && (
                      <pre className="mt-2 p-2 bg-phino-canvas rounded text-2xs overflow-x-auto text-phino-text-muted">
                        {JSON.stringify(ev, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Col: HITL Signal Dispatcher */}
        <div className="rounded-xl border border-phino-border bg-phino-surface p-4 space-y-4">
          <div className="border-b border-phino-border pb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-phino-text">
              <Terminal className="h-3.5 w-3.5 text-phino-signal" />
              <span>Human-in-the-Loop Signal Dispatch</span>
            </div>
            <p className="text-2xs text-phino-text-muted mt-1">
              Manually trigger state transitions or approve gates.
            </p>
          </div>

          <form onSubmit={handleEmitSignal} className="space-y-3">
            <div>
              <label className="text-2xs font-medium text-phino-text-muted block mb-1">Signal Name</label>
              <input
                type="text"
                value={signalInput}
                onChange={(e) => setSignalInput(e.target.value)}
                placeholder="e.g. APPROVED, RETRY, ABORT"
                className="w-full rounded-lg border border-phino-border bg-phino-canvas px-3 py-1.5 font-mono text-xs text-phino-text focus:outline-none focus:ring-1 focus:ring-phino-signal"
                disabled={status !== 'connected' || signalSending}
              />
            </div>

            <button
              type="submit"
              disabled={status !== 'connected' || signalSending || !signalInput.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-phino-signal px-3 py-2 text-xs font-semibold text-phino-canvas hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
              {signalSending ? 'Emitting...' : 'Emit Signal to Agent'}
            </button>
          </form>

          {/* Context Keys Preview */}
          <div className="pt-2 border-t border-phino-border">
            <div className="text-2xs font-semibold text-phino-text-muted uppercase mb-1.5">Context Snapshot</div>
            <pre className="p-2 bg-phino-canvas rounded text-2xs overflow-x-auto text-phino-text-muted max-h-36">
              {Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '// No context keys set'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
