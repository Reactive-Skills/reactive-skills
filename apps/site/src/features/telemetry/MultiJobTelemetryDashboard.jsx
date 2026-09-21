'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_BROKER_URL = 'http://127.0.0.1:4242';

export const telemetryTargetKey = ({ skillId, jobId }) => `${skillId}/${jobId}`;

const getErrorMessage = (error) => {
  if (error?.message === 'Failed to fetch') {
    return 'Local Network access was blocked. Allow this site to access the broker, then reconnect.';
  }
  return error?.message || 'Telemetry broker connection failed';
};

const emptyCard = (target) => ({
  ...target,
  status: 'connecting',
  activeState: 'Loading state',
  context: {},
  eventCount: 0,
  latestSignal: '',
  events: [],
  error: '',
  stateErrorType: '',
  stateError: '',
});

function normalizeBrokerUrl(value) {
  return value.trim().replace(/\/$/, '');
}

function findCatalogTarget(catalog, target) {
  const skill = catalog?.skills?.find((entry) => entry.skillId === target.skillId);
  return skill?.jobs?.find((entry) => entry.jobId === target.jobId) || null;
}

export function MultiJobTelemetryDashboard() {
  const [brokerUrlInput, setBrokerUrlInput] = useState(DEFAULT_BROKER_URL);
  const [brokerUrl, setBrokerUrl] = useState(DEFAULT_BROKER_URL);
  const [catalog, setCatalog] = useState(null);
  const [catalogStatus, setCatalogStatus] = useState('loading');
  const [catalogError, setCatalogError] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [trackedTargets, setTrackedTargets] = useState([]);
  const [cards, setCards] = useState({});
  const eventSourceRef = useRef(null);

  const selectedSkill = useMemo(
    () => catalog?.skills?.find((skill) => skill.skillId === selectedSkillId) || null,
    [catalog, selectedSkillId],
  );

  const targetQuery = useMemo(
    () => trackedTargets.map(telemetryTargetKey).join('|'),
    [trackedTargets],
  );

  const loadCatalog = async () => {
    const baseUrl = normalizeBrokerUrl(brokerUrl);
    if (!baseUrl) {
      setCatalogError('Enter the broker URL before connecting.');
      setCatalogStatus('error');
      return;
    }

    setCatalogStatus('loading');
    setCatalogError('');
    try {
      const response = await fetch(`${baseUrl}/catalog`, {
        cache: 'no-store',
        targetAddressSpace: 'loopback',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Catalog request failed (${response.status})`);
      setCatalog(payload);
      setCatalogStatus('ready');
    } catch (error) {
      setCatalogStatus('error');
      setCatalogError(getErrorMessage(error));
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [brokerUrl]);

  useEffect(() => {
    const firstSkill = catalog?.skills?.[0];
    if (!firstSkill) {
      setSelectedSkillId('');
      setSelectedJobId('');
      return;
    }

    const nextSkillId = catalog.skills.some((skill) => skill.skillId === selectedSkillId)
      ? selectedSkillId
      : firstSkill.skillId;
    const nextSkill = catalog.skills.find((skill) => skill.skillId === nextSkillId) || firstSkill;
    const nextJobId = nextSkill.jobs.some((job) => job.jobId === selectedJobId)
      ? selectedJobId
      : nextSkill.jobs[0]?.jobId || '';
    setSelectedSkillId(nextSkill.skillId);
    setSelectedJobId(nextJobId);
  }, [catalog]);

  useEffect(() => {
    setCards((previous) => {
      const next = {};
      for (const target of trackedTargets) {
        const key = telemetryTargetKey(target);
        next[key] = previous[key] || emptyCard(target);
      }
      return next;
    });
  }, [targetQuery]);

  useEffect(() => {
    let cancelled = false;

    const loadStates = async () => {
      await Promise.all(trackedTargets.map(async (target) => {
        const key = telemetryTargetKey(target);
        try {
          const params = new URLSearchParams({ skillId: target.skillId, jobId: target.jobId });
          const response = await fetch(`${normalizeBrokerUrl(brokerUrl)}/state?${params}`, {
            cache: 'no-store',
            targetAddressSpace: 'loopback',
          });
          const payload = await response.json();
          if (!response.ok) {
            const error = new Error(payload.error || `State request failed (${response.status})`);
            error.status = response.status;
            throw error;
          }
          if (cancelled) return;
          setCards((previous) => ({
            ...previous,
            [key]: {
              ...(previous[key] || emptyCard(target)),
              status: previous[key]?.status === 'connected' ? 'connected' : 'connecting',
              activeState: payload.activeState || 'Unknown',
              context: payload.context || {},
              eventCount: payload.eventCount || 0,
              latestSignal: payload.latestSignal || '',
              error: '',
              stateErrorType: '',
              stateError: '',
            },
          }));
        } catch (error) {
          if (cancelled) return;
          const stateErrorType = error?.status === 404 ? 'invalid-target' : 'error';
          setCards((previous) => ({
            ...previous,
            [key]: {
              ...(previous[key] || emptyCard(target)),
              stateErrorType,
              stateError: getErrorMessage(error),
            },
          }));
        }
      }));
    };

    if (trackedTargets.length > 0) loadStates();
    return () => {
      cancelled = true;
    };
  }, [brokerUrl, targetQuery]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (trackedTargets.length === 0) return undefined;

    const streamUrl = new URL(`${normalizeBrokerUrl(brokerUrl)}/events`);
    streamUrl.searchParams.set('sinceSeq', '0');
    trackedTargets.forEach((target) => {
      streamUrl.searchParams.append('target', telemetryTargetKey(target));
    });

    const source = new EventSource(streamUrl.toString());
    eventSourceRef.current = source;
    let closed = false;

    source.onopen = () => {
      setCards((previous) => {
        const next = { ...previous };
        trackedTargets.forEach((target) => {
          const key = telemetryTargetKey(target);
          next[key] = { ...(next[key] || emptyCard(target)), status: 'connected', error: '' };
        });
        return next;
      });
    };

    source.addEventListener('telemetry_event', (message) => {
      try {
        const envelope = JSON.parse(message.data);
        const key = telemetryTargetKey(envelope);
        const target = trackedTargets.find((entry) => telemetryTargetKey(entry) === key);
        if (!target || envelope.skillId !== target.skillId || envelope.jobId !== target.jobId) return;

        setCards((previous) => {
          const card = previous[key] || emptyCard(target);
          if (card.events.some((event) => event.seq === envelope.seq)) return previous;
          const nextEvents = [...card.events, envelope].sort((a, b) => a.seq - b.seq);
          return {
            ...previous,
            [key]: {
              ...card,
              status: 'connected',
              activeState: envelope.event?.state || card.activeState,
              latestSignal: envelope.type,
              eventCount: nextEvents.length,
              events: nextEvents,
              error: '',
            },
          };
        });
      } catch {
        // Ignore malformed events and keep the stream alive.
      }
    });

    source.onerror = () => {
      if (closed) return;
      setCards((previous) => {
        const next = { ...previous };
        trackedTargets.forEach((target) => {
          const key = telemetryTargetKey(target);
          next[key] = {
            ...(next[key] || emptyCard(target)),
            status: 'error',
            error: 'Live event stream disconnected.',
          };
        });
        return next;
      });
    };

    return () => {
      closed = true;
      source.close();
      if (eventSourceRef.current === source) eventSourceRef.current = null;
    };
  }, [brokerUrl, targetQuery]);

  const connectBroker = (event) => {
    event.preventDefault();
    const nextUrl = normalizeBrokerUrl(brokerUrlInput);
    setBrokerUrl(nextUrl);
  };

  const addSelectedTarget = () => {
    if (!selectedSkillId || !selectedJobId) return;
    const target = { skillId: selectedSkillId, jobId: selectedJobId };
    if (!findCatalogTarget(catalog, target)) return;
    setTrackedTargets((previous) => previous.some((entry) => telemetryTargetKey(entry) === telemetryTargetKey(target))
      ? previous
      : [...previous, target]);
  };

  const removeTarget = (target) => {
    const key = telemetryTargetKey(target);
    setTrackedTargets((previous) => previous.filter((entry) => telemetryTargetKey(entry) !== key));
    setCards((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const statusLabel = catalogStatus === 'ready' ? 'Broker connected' : catalogStatus === 'loading' ? 'Connecting' : 'Connection error';
  const hasJobs = (catalog?.skills || []).some((skill) => skill.jobs?.length > 0);

  return (
    <section className="space-y-6" aria-labelledby="telemetry-dashboard-title">
      <div className="rounded-2xl border border-phino-border bg-phino-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-phino-signal-text">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Live telemetry
            </div>
            <h1 id="telemetry-dashboard-title" className="mt-2 text-2xl font-semibold text-phino-text">
              Multi-job telemetry dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-phino-text-muted">
              Connect to one local broker, select jobs from its catalog, and monitor isolated event streams through one browser connection.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-phino-text-muted" role="status" aria-live="polite">
            {catalogStatus === 'ready' ? <CheckCircle2 className="h-4 w-4 text-phino-success" aria-hidden="true" /> : <WifiOff className="h-4 w-4 text-phino-warning" aria-hidden="true" />}
            {statusLabel}
          </div>
        </div>

        <form onSubmit={connectBroker} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="broker-url" className="sr-only">Broker URL</label>
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-phino-text-muted" aria-hidden="true" />
            <input
              id="broker-url"
              value={brokerUrlInput}
              onChange={(event) => setBrokerUrlInput(event.target.value)}
              placeholder={DEFAULT_BROKER_URL}
              className="w-full rounded-lg border border-phino-border bg-phino-canvas py-2.5 pl-9 pr-3 font-mono text-sm text-phino-text outline-none focus:border-phino-focus focus:ring-1 focus:ring-phino-focus"
            />
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-phino-text px-4 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90">
            Connect broker
          </button>
          <button type="button" onClick={loadCatalog} className="inline-flex items-center justify-center gap-2 rounded-lg border border-phino-border px-4 py-2.5 text-sm font-semibold text-phino-text transition-colors hover:bg-phino-surface-raised" aria-label="Refresh broker catalog">
            <RefreshCw className={cn('h-4 w-4', catalogStatus === 'loading' && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </form>

        {catalogError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-phino-warning/40 bg-phino-warning/10 p-3 text-sm text-phino-text" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-phino-warning" aria-hidden="true" />
            <span>{catalogError}</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-phino-border bg-phino-surface p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="telemetry-skill" className="mb-1.5 block text-xs font-semibold text-phino-text-muted">Skill</label>
            <select id="telemetry-skill" value={selectedSkillId} onChange={(event) => { setSelectedSkillId(event.target.value); setSelectedJobId(''); }} className="w-full rounded-lg border border-phino-border bg-phino-canvas px-3 py-2.5 text-sm text-phino-text outline-none focus:border-phino-focus focus:ring-1 focus:ring-phino-focus">
              <option value="">Select a skill</option>
              {(catalog?.skills || []).map((skill) => <option key={skill.skillId} value={skill.skillId}>{skill.skillName} ({skill.skillId})</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="telemetry-job" className="mb-1.5 block text-xs font-semibold text-phino-text-muted">Job</label>
            <select id="telemetry-job" value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="w-full rounded-lg border border-phino-border bg-phino-canvas px-3 py-2.5 text-sm text-phino-text outline-none focus:border-phino-focus focus:ring-1 focus:ring-phino-focus" disabled={!selectedSkill}>
              <option value="">Select a job</option>
              {(selectedSkill?.jobs || []).map((job) => <option key={job.jobId} value={job.jobId}>{job.jobId} · {job.currentState}</option>)}
            </select>
          </div>
          <button type="button" onClick={addSelectedTarget} disabled={!selectedSkillId || !selectedJobId} className="inline-flex items-center justify-center gap-2 rounded-lg bg-phino-signal px-4 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Track job
          </button>
        </div>
        <p className="mt-3 text-xs text-phino-text-muted">The dashboard keeps one multiplexed SSE connection for all tracked jobs.</p>
      </div>

      {catalogStatus === 'loading' && !catalog && (
        <div className="rounded-2xl border border-phino-border bg-phino-surface p-10 text-center text-sm text-phino-text-muted" role="status">Loading broker catalog...</div>
      )}

      {catalogStatus === 'ready' && !hasJobs && (
        <div className="rounded-2xl border border-dashed border-phino-border bg-phino-surface p-10 text-center" role="status">
          <p className="text-sm font-semibold text-phino-text">No jobs discovered</p>
          <p className="mt-1 text-sm text-phino-text-muted">Start a skill job, then refresh the broker catalog.</p>
        </div>
      )}

      {catalogStatus === 'ready' && hasJobs && trackedTargets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-phino-border bg-phino-surface p-10 text-center" role="status">
          <p className="text-sm font-semibold text-phino-text">No tracked jobs</p>
          <p className="mt-1 text-sm text-phino-text-muted">Select a skill and job above to add the first live card.</p>
        </div>
      )}

      {trackedTargets.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {trackedTargets.map((target) => {
            const key = telemetryTargetKey(target);
            const card = cards[key] || emptyCard(target);
            const catalogTarget = findCatalogTarget(catalog, target);
            return (
              <article key={key} className="overflow-hidden rounded-2xl border border-phino-border bg-phino-surface shadow-sm">
                <header className="flex items-start justify-between gap-3 border-b border-phino-border p-4">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-phino-signal-text">{target.skillId}</div>
                    <h2 className="mt-1 truncate font-mono text-lg font-semibold text-phino-text" data-testid={`telemetry-job-${key}`}>{target.jobId}</h2>
                    <p className="mt-1 text-xs text-phino-text-muted">{catalogTarget?.isActive ? 'Active job' : 'Parallel job'} · {catalogTarget?.status || 'Unknown status'}</p>
                  </div>
                  <button type="button" onClick={() => removeTarget(target)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-phino-text-muted transition-colors hover:bg-phino-surface-raised hover:text-phino-text" aria-label={`Remove ${target.jobId}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </header>

                {card.stateErrorType === 'invalid-target' && (
                  <div className="flex items-start gap-2 border-b border-phino-warning/30 bg-phino-warning/10 p-4 text-sm text-phino-text" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-phino-warning" aria-hidden="true" />
                    <span>Invalid target. Refresh the catalog and select this job again.</span>
                  </div>
                )}

                {(card.stateErrorType === 'error' || card.status === 'error') && (
                  <div className="flex items-start gap-2 border-b border-phino-warning/30 bg-phino-warning/10 p-4 text-sm text-phino-text" role="alert">
                    <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-phino-warning" aria-hidden="true" />
                    <span>Connection error. {card.stateError || card.error || 'The broker could not provide this job state.'}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                  <Metric label="Connection" value={card.status === 'connected' ? 'Live' : card.status === 'error' ? 'Error' : 'Connecting'} icon={card.status === 'connected' ? Wifi : WifiOff} />
                  <Metric label="Current HSM state" value={card.activeState || 'Unknown'} />
                  <Metric label="Recorded events" value={String(card.eventCount)} />
                  <Metric label="Latest signal" value={card.latestSignal || 'None'} />
                </div>

                <div className="border-t border-phino-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-phino-text"><Activity className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />Event ledger</div>
                    <span className="font-mono text-2xs text-phino-text-muted">{card.events.length} visible</span>
                  </div>
                  <div className="max-h-56 divide-y divide-phino-border/50 overflow-y-auto rounded-lg border border-phino-border bg-phino-canvas font-mono text-xs">
                    {card.events.length === 0 ? (
                      <div className="p-5 text-center text-phino-text-muted">No events received for this job yet.</div>
                    ) : card.events.slice().reverse().map((event) => (
                      <div key={`${event.jobId}:${event.seq}`} className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-phino-text-muted">#{event.seq}</span>
                            <span className="truncate font-semibold text-phino-signal-text">{event.type}</span>
                          </div>
                          <div className="mt-1 truncate text-2xs text-phino-text-muted">{event.skillId} / {event.jobId}</div>
                        </div>
                        <time className="shrink-0 text-2xs text-phino-text-subtle" dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time>
                      </div>
                    ))}
                  </div>
                  {card.error && card.status === 'error' && <p className="mt-3 text-xs text-phino-warning">{card.error}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-lg border border-phino-border bg-phino-canvas p-3">
      <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-phino-text-muted">{Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-phino-text" title={value}>{value}</div>
    </div>
  );
}
