export interface DashboardOptions {
  skillName?: string;
  port: number;
  host: string;
}

/**
 * Generates a self-contained, zero-dependency HTML dashboard for the TelemetryServer.
 * Provides live SSE event streaming, state & context inspection, and signal dispatching.
 */
export function renderDashboardHtml(options: DashboardOptions): string {
  const titleSkill = options.skillName || 'Reactive Skill';

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ ${escapeHtml(titleSkill)} — Reactive Skills Telemetry</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f2937;
      --card-hover: #1e293b;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --text-dim: #6b7280;
      --primary: #38bdf8;
      --primary-hover: #0ea5e9;
      --accent: #818cf8;
      --success: #34d399;
      --warning: #fbbf24;
      --danger: #f87171;
      --transition-bg: #312e81;
      --transition-text: #c7d2fe;
      --guard-bg: #064e3b;
      --guard-text: #a7f3d0;
      --tool-bg: #78350f;
      --tool-text: #fde68a;
      --mono-font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --sans-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--sans-font);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      background-color: var(--card-bg);
      border-bottom: 1px solid var(--card-border);
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-logo {
      font-size: 1.5rem;
      line-height: 1;
    }
    .brand-title {
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }
    .brand-skill {
      background: linear-gradient(135deg, #0284c7 0%, #6366f1 100%);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: var(--mono-font);
    }

    .header-metrics {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.85rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background-color: #064e3b;
      color: #34d399;
      border: 1px solid #059669;
    }
    .status-badge.connecting {
      background-color: #78350f;
      color: #fbbf24;
      border-color: #d97706;
    }
    .status-badge.disconnected {
      background-color: #4c0519;
      color: #f87171;
      border-color: #e11d48;
    }
    .status-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background-color: currentColor;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .header-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.8rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      transition: all 0.15s;
    }
    .header-links a:hover {
      color: var(--primary);
      background-color: var(--card-hover);
    }

    main {
      flex: 1;
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 1.25rem;
      padding: 1.25rem;
      max-width: 1700px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 960px) {
      main {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .card-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .state-panel {
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .active-state-banner {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 1rem;
      border-radius: 0.625rem;
    }
    .active-state-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .active-state-name {
      font-size: 1.4rem;
      font-weight: 800;
      font-family: var(--mono-font);
      color: #fff;
      margin-top: 0.25rem;
      word-break: break-all;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .meta-box {
      background-color: #0b1120;
      border: 1px solid var(--card-border);
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
    }
    .meta-box-label {
      font-size: 0.7rem;
      color: var(--text-dim);
      text-transform: uppercase;
    }
    .meta-box-val {
      font-size: 0.95rem;
      font-weight: 600;
      font-family: var(--mono-font);
      color: var(--text-main);
      margin-top: 0.15rem;
    }

    .dispatch-box {
      border-top: 1px solid var(--card-border);
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .form-group label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .input-field {
      width: 100%;
      background-color: #0b1120;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.55rem 0.75rem;
      border-radius: 0.5rem;
      font-family: var(--mono-font);
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .input-field:focus {
      border-color: var(--primary);
    }
    textarea.input-field {
      min-height: 70px;
      resize: vertical;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.55rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 0.5rem;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }
    .btn-primary {
      background-color: #0284c7;
      color: #fff;
    }
    .btn-primary:hover {
      background-color: #0ea5e9;
    }
    .btn-secondary {
      background-color: var(--card-hover);
      color: var(--text-muted);
      border: 1px solid var(--card-border);
    }
    .btn-secondary:hover {
      background-color: #334155;
      color: var(--text-main);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .dispatch-feedback {
      font-size: 0.8rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      display: none;
      font-family: var(--mono-font);
    }
    .dispatch-feedback.success {
      display: block;
      background-color: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
    }
    .dispatch-feedback.error {
      display: block;
      background-color: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    .context-accordion {
      border-top: 1px solid var(--card-border);
      padding: 1.15rem;
    }
    .context-accordion summary {
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      user-select: none;
      outline: none;
    }
    .context-accordion summary:hover {
      color: var(--primary);
    }
    .context-json {
      background-color: #0b1120;
      border: 1px solid var(--card-border);
      padding: 0.75rem;
      border-radius: 0.5rem;
      font-family: var(--mono-font);
      font-size: 0.75rem;
      color: #cbd5e1;
      overflow-x: auto;
      max-height: 250px;
      margin-top: 0.6rem;
    }

    /* Event Ledger View */
    .ledger-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 600px;
    }

    .ledger-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-select {
      background-color: #0b1120;
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      outline: none;
    }

    .events-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      background-color: #0b1120;
      max-height: calc(100vh - 160px);
    }

    .event-item {
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 0.5rem;
      padding: 0.6rem 0.85rem;
      font-size: 0.8rem;
      transition: background-color 0.15s, border-color 0.15s;
      cursor: pointer;
    }
    .event-item:hover {
      background-color: #1e293b;
      border-color: #334155;
    }

    .event-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .event-type-pill {
      font-family: var(--mono-font);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 0.25rem;
      letter-spacing: 0.02em;
    }
    .type-STATE_TRANSITION {
      background-color: var(--transition-bg);
      color: var(--transition-text);
      border: 1px solid #4338ca;
    }
    .type-GUARD_EVALUATED {
      background-color: var(--guard-bg);
      color: var(--guard-text);
      border: 1px solid #047857;
    }
    .type-TOOL_CALL, .type-TOOL_EXECUTION {
      background-color: var(--tool-bg);
      color: var(--tool-text);
      border: 1px solid #b45309;
    }
    .type-SKILL_INITIALIZED {
      background-color: #082f49;
      color: #7dd3fc;
      border: 1px solid #0369a1;
    }
    .type-other {
      background-color: #1f2937;
      color: #9ca3af;
      border: 1px solid #374151;
    }

    .event-seq {
      font-family: var(--mono-font);
      color: var(--text-dim);
      font-size: 0.75rem;
    }
    .event-time {
      font-size: 0.7rem;
      color: var(--text-dim);
      font-family: var(--mono-font);
    }

    .event-summary {
      margin-top: 0.35rem;
      font-size: 0.825rem;
      color: #e2e8f0;
      font-family: var(--mono-font);
      word-break: break-word;
    }

    .event-payload-box {
      margin-top: 0.5rem;
      padding: 0.5rem;
      background-color: #090d16;
      border: 1px solid #1f2937;
      border-radius: 0.375rem;
      font-family: var(--mono-font);
      font-size: 0.725rem;
      color: #94a3b8;
      overflow-x: auto;
      display: none;
    }
    .event-item.expanded .event-payload-box {
      display: block;
    }

    .empty-events {
      padding: 3rem 1rem;
      text-align: center;
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    footer {
      border-top: 1px solid var(--card-border);
      padding: 0.75rem 1.5rem;
      font-size: 0.75rem;
      color: var(--text-dim);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--card-bg);
    }
    footer a {
      color: var(--primary);
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <span class="brand-logo">⚡</span>
      <span class="brand-title">Reactive Skills</span>
      <span class="brand-skill" id="skillNameBadge">${escapeHtml(titleSkill)}</span>
    </div>

    <div class="header-metrics">
      <div class="status-badge connecting" id="connectionBadge">
        <span class="status-dot"></span>
        <span id="connectionText">Connecting...</span>
      </div>

      <div class="header-links">
        <a href="/state" target="_blank">/state</a>
        <a href="/events/history" target="_blank">/history</a>
        <a href="/health" target="_blank">/health</a>
      </div>
    </div>
  </header>

  <main>
    <!-- Left Column: Active State & Controls -->
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Active State & Context</span>
          <button class="btn btn-secondary btn-sm" id="refreshStateBtn" title="Refresh state from server">↻ Refresh</button>
        </div>

        <div class="state-panel">
          <div class="active-state-banner">
            <div class="active-state-label">Current State</div>
            <div class="active-state-name" id="activeStateDisplay">LOADING...</div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <div class="meta-box-label">Sequence</div>
              <div class="meta-box-val" id="latestSeqDisplay">0</div>
            </div>
            <div class="meta-box">
              <div class="meta-box-label">Uptime</div>
              <div class="meta-box-val" id="uptimeDisplay">0s</div>
            </div>
          </div>
        </div>

        <!-- Signal Dispatcher -->
        <div class="dispatch-box">
          <div class="card-title" style="font-size: 0.8rem; margin-bottom: 0.25rem;">Dispatch Signal</div>
          <form id="signalForm">
            <div class="form-group">
              <label for="signalInput">Signal Name</label>
              <input type="text" id="signalInput" class="input-field" placeholder="e.g. RUNTIME_READY" required autocomplete="off">
            </div>

            <div class="form-group" style="margin-top: 0.5rem;">
              <label for="payloadInput">Payload (JSON, optional)</label>
              <textarea id="payloadInput" class="input-field" placeholder='{"key": "value"}'></textarea>
            </div>

            <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
              <button type="submit" class="btn btn-primary" id="emitBtn" style="flex: 1;">⚡ Emit Signal</button>
            </div>
          </form>
          <div class="dispatch-feedback" id="dispatchFeedback"></div>
        </div>

        <!-- Context Inspector -->
        <details class="context-accordion" id="contextDetails">
          <summary>Inspect FSM Context (<span id="contextKeyCount">0</span> keys)</summary>
          <pre class="context-json" id="contextDisplay">{}</pre>
        </details>
      </div>
    </div>

    <!-- Right Column: Live Event Stream -->
    <div class="card ledger-container">
      <div class="card-header">
        <div class="card-title">
          <span>Live Event Ledger</span>
          <span style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--mono-font);" id="eventCountBadge">(0 events)</span>
        </div>
        <div class="ledger-controls">
          <select class="filter-select" id="eventFilter">
            <option value="ALL">All Events</option>
            <option value="STATE_TRANSITION">Transitions</option>
            <option value="GUARD_EVALUATED">Guards</option>
            <option value="TOOL_CALL">Tools</option>
            <option value="SKILL_INITIALIZED">Init</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="pauseBtn">⏸ Pause</button>
          <button class="btn btn-secondary btn-sm" id="clearBtn">Clear</button>
        </div>
      </div>

      <div class="events-scroll" id="eventsList">
        <div class="empty-events" id="emptyEvents">Connecting to event stream...</div>
      </div>
    </div>
  </main>

  <footer>
    <div>Reactive Skills Architecture (RSA) • Telemetry Daemon v0.4.1</div>
    <div>Running on <code>http://${escapeHtml(options.host)}:${options.port}</code></div>
  </footer>

  <script>
    (function () {
      let eventSource = null;
      let isPaused = false;
      let allEvents = [];
      let autoScroll = true;

      const connectionBadge = document.getElementById('connectionBadge');
      const connectionText = document.getElementById('connectionText');
      const activeStateDisplay = document.getElementById('activeStateDisplay');
      const latestSeqDisplay = document.getElementById('latestSeqDisplay');
      const uptimeDisplay = document.getElementById('uptimeDisplay');
      const contextDisplay = document.getElementById('contextDisplay');
      const contextKeyCount = document.getElementById('contextKeyCount');
      const eventsList = document.getElementById('eventsList');
      const emptyEvents = document.getElementById('emptyEvents');
      const eventCountBadge = document.getElementById('eventCountBadge');
      const eventFilter = document.getElementById('eventFilter');
      const pauseBtn = document.getElementById('pauseBtn');
      const clearBtn = document.getElementById('clearBtn');
      const refreshStateBtn = document.getElementById('refreshStateBtn');
      const signalForm = document.getElementById('signalForm');
      const signalInput = document.getElementById('signalInput');
      const payloadInput = document.getElementById('payloadInput');
      const emitBtn = document.getElementById('emitBtn');
      const dispatchFeedback = document.getElementById('dispatchFeedback');
      const skillNameBadge = document.getElementById('skillNameBadge');

      // Auto-detect scroll position
      eventsList.addEventListener('scroll', () => {
        const atBottom = eventsList.scrollHeight - eventsList.scrollTop - eventsList.clientHeight < 40;
        autoScroll = atBottom;
      });

      function setConnectionStatus(status, text) {
        connectionBadge.className = 'status-badge ' + status;
        connectionText.textContent = text;
      }

      async function fetchState() {
        try {
          const res = await fetch('/state');
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          if (data.skillName) {
            skillNameBadge.textContent = data.skillName;
            document.title = '⚡ ' + data.skillName + ' — Reactive Skills Telemetry';
          }
          activeStateDisplay.textContent = data.activeState || 'UNKNOWN';
          latestSeqDisplay.textContent = data.latestSeq !== undefined ? data.latestSeq : '0';

          const ctx = data.context || {};
          contextDisplay.textContent = JSON.stringify(ctx, null, 2);
          contextKeyCount.textContent = Object.keys(ctx).length;
        } catch (err) {
          console.warn('Failed to fetch state:', err);
        }
      }

      async function fetchHealth() {
        try {
          const res = await fetch('/health');
          if (res.ok) {
            const data = await res.json();
            if (data.uptimeSeconds !== undefined) {
              const u = data.uptimeSeconds;
              const mins = Math.floor(u / 60);
              const secs = u % 60;
              uptimeDisplay.textContent = mins > 0 ? (mins + 'm ' + secs + 's') : (secs + 's');
            }
          }
        } catch {}
      }

      async function fetchHistory() {
        try {
          const res = await fetch('/events/history?limit=100');
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data.events) && data.events.length > 0) {
            allEvents = data.events;
            renderEvents();
          }
        } catch (err) {
          console.warn('Failed to fetch initial history:', err);
        }
      }

      function formatSummary(evt) {
        if (!evt) return '';
        const p = evt.payload || {};
        if (evt.type === 'STATE_TRANSITION') {
          return (p.from || '?') + ' ──► ' + (p.to || '?') + (p.signal ? (' (via ' + p.signal + ')') : '');
        }
        if (evt.type === 'GUARD_EVALUATED') {
          return 'Guard [' + (p.guard || '') + ']: ' + (p.result ? 'PASS ✅' : 'FAIL ❌');
        }
        if (evt.type === 'TOOL_CALL') {
          return 'Tool call: ' + (p.tool || p.name || 'unnamed');
        }
        if (evt.type === 'SKILL_INITIALIZED') {
          return 'Skill ' + (p.skill || '') + ' initialized at ' + (p.initial_state || 'INIT');
        }
        return JSON.stringify(p);
      }

      function renderEvents() {
        const filter = eventFilter.value;
        const filtered = filter === 'ALL'
          ? allEvents
          : allEvents.filter(e => {
              if (filter === 'TOOL_CALL') return e.type === 'TOOL_CALL' || e.type === 'TOOL_EXECUTION';
              return e.type === filter;
            });

        eventCountBadge.textContent = '(' + filtered.length + ' events)';

        if (filtered.length === 0) {
          emptyEvents.style.display = 'block';
          emptyEvents.textContent = allEvents.length === 0 ? 'No events recorded yet.' : 'No events match the selected filter.';
          return;
        }

        emptyEvents.style.display = 'none';

        // Clear existing children except emptyEvents
        Array.from(eventsList.children).forEach(child => {
          if (child !== emptyEvents) eventsList.removeChild(child);
        });

        filtered.forEach((evt, idx) => {
          const item = document.createElement('div');
          item.className = 'event-item';

          const typeClass = 'type-' + (evt.type in {
            STATE_TRANSITION: 1, GUARD_EVALUATED: 1, TOOL_CALL: 1, TOOL_EXECUTION: 1, SKILL_INITIALIZED: 1
          } ? evt.type : 'other');

          const timeStr = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : '';
          const seqStr = evt.sequence !== undefined ? ('#' + evt.sequence) : ('#' + (idx + 1));

          item.innerHTML =
            '<div class="event-header">' +
              '<span class="event-type-pill ' + typeClass + '">' + escapeHtml(evt.type || 'EVENT') + '</span>' +
              '<div style="display:flex; gap:0.5rem; align-items:center;">' +
                '<span class="event-time">' + escapeHtml(timeStr) + '</span>' +
                '<span class="event-seq">' + escapeHtml(seqStr) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="event-summary">' + escapeHtml(formatSummary(evt)) + '</div>' +
            '<pre class="event-payload-box">' + escapeHtml(JSON.stringify(evt.payload || {}, null, 2)) + '</pre>';

          item.addEventListener('click', () => {
            item.classList.toggle('expanded');
          });

          eventsList.appendChild(item);
        });

        if (autoScroll) {
          eventsList.scrollTop = eventsList.scrollHeight;
        }
      }

      function appendEvent(evt) {
        if (!evt) return;
        allEvents.push(evt);
        if (allEvents.length > 500) allEvents.shift();

        if (evt.type === 'STATE_TRANSITION' || evt.type === 'SKILL_INITIALIZED') {
          fetchState();
        }
        if (evt.sequence !== undefined) {
          latestSeqDisplay.textContent = evt.sequence;
        }

        if (!isPaused) {
          renderEvents();
        }
      }

      function initSse() {
        if (eventSource) {
          try { eventSource.close(); } catch {}
        }

        setConnectionStatus('connecting', 'Connecting...');
        eventSource = new EventSource('/events');

        eventSource.addEventListener('connected', () => {
          setConnectionStatus('', 'Connected (SSE)');
        });

        eventSource.onopen = () => {
          setConnectionStatus('', 'Connected (SSE)');
        };

        eventSource.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            appendEvent(parsed);
          } catch (err) {
            console.warn('Failed to parse event JSON:', err);
          }
        };

        eventSource.onerror = () => {
          setConnectionStatus('disconnected', 'Reconnecting...');
        };
      }

      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      // Signal Form Submit
      signalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const signal = signalInput.value.trim();
        if (!signal) return;

        let payload = {};
        const rawPayload = payloadInput.value.trim();
        if (rawPayload) {
          try {
            payload = JSON.parse(rawPayload);
          } catch (err) {
            dispatchFeedback.className = 'dispatch-feedback error';
            dispatchFeedback.textContent = 'Invalid JSON payload: ' + err.message;
            return;
          }
        }

        emitBtn.disabled = true;
        emitBtn.textContent = 'Emitting...';
        dispatchFeedback.style.display = 'none';

        try {
          const res = await fetch('/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signal, payload })
          });
          const result = await res.json();

          if (!res.ok || result.error) {
            dispatchFeedback.className = 'dispatch-feedback error';
            dispatchFeedback.textContent = 'Emission error: ' + (result.error || 'HTTP ' + res.status);
          } else {
            dispatchFeedback.className = 'dispatch-feedback success';
            dispatchFeedback.textContent = result.transitioned
              ? '✅ Transitioned ──► ' + result.newState
              : '⚡ Signal evaluated (no transition occurred)';
            signalInput.value = '';
            fetchState();
          }
        } catch (err) {
          dispatchFeedback.className = 'dispatch-feedback error';
          dispatchFeedback.textContent = 'Network error: ' + err.message;
        } finally {
          emitBtn.disabled = false;
          emitBtn.textContent = '⚡ Emit Signal';
        }
      });

      // Controls
      pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
        if (!isPaused) renderEvents();
      });

      clearBtn.addEventListener('click', () => {
        allEvents = [];
        renderEvents();
      });

      eventFilter.addEventListener('change', () => {
        renderEvents();
      });

      refreshStateBtn.addEventListener('click', () => {
        fetchState();
        fetchHealth();
      });

      // Boot
      fetchState();
      fetchHealth();
      fetchHistory().then(initSse);
      setInterval(fetchHealth, 5000);
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
