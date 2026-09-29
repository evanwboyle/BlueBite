import { API_BASE_URL } from './config';

export type SSEEventType =
  | 'order:created'
  | 'order:updated'
  | 'payment:updated'
  | 'menu:created'
  | 'menu:updated'
  | 'menu:deleted';

export interface SSEConnection {
  close: () => void;
}

// Singleton: only one EventSource connection at a time.
// Prevents browser connection pool exhaustion (browsers limit ~6 connections per host).
let activeEventSource: EventSource | null = null;

/**
 * Connect to the backend SSE event stream.
 * Closes any existing connection before opening a new one.
 * Returns a connection object with a close() method for cleanup.
 */
export function connectSSE(
  buttery: string | null,
  onEvent: (type: SSEEventType, data: unknown) => void,
): SSEConnection {
  return import.meta.env.VITE_REALTIME === 'ably'
    ? connectAbly(buttery, onEvent)
    : connectEventSource(buttery, onEvent);
}

const EVENT_TYPES: SSEEventType[] = [
  'order:created',
  'order:updated',
  'payment:updated',
  'menu:created',
  'menu:updated',
  'menu:deleted',
];

/**
 * Managed push (Ably): the backend publishes each event to a per-buttery channel and hands out a
 * subscribe-only token at /realtime/token. The Ably client is loaded on demand so SSE-only builds
 * do not ship it. Ably reconnects on its own.
 */
function connectAbly(
  buttery: string | null,
  onEvent: (type: SSEEventType, data: unknown) => void,
): SSEConnection {
  let closed = false;
  let client: { close: () => void } | null = null;

  const authUrl = buttery
    ? `${API_BASE_URL}/realtime/token?buttery=${encodeURIComponent(buttery)}`
    : `${API_BASE_URL}/realtime/token`;

  import('ably')
    .then(async (Ably) => {
      if (closed) return;
      // authCallback rather than authUrl so the session cookie is sent (the token route requires login,
      // and in dev the API is on another origin).
      const realtime = new Ably.Realtime({
        authCallback: (_params, callback) => {
          fetch(authUrl, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Token request failed: HTTP ${r.status}`))))
            .then((token) => callback(null, token))
            .catch((err) => callback(String(err instanceof Error ? err.message : err), null));
        },
      });
      client = realtime;
      const slug = (b: string | null) =>
        `bluebite:${(b ?? 'all').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'all'}`;
      for (const channelName of new Set([slug(buttery), slug(null)])) {
        await realtime.channels.get(channelName).subscribe((message) => {
          if (closed || !EVENT_TYPES.includes(message.name as SSEEventType)) return;
          onEvent(message.name as SSEEventType, message.data);
        });
      }
    })
    .catch((err) => console.error('[Realtime] Failed to connect to Ably:', err));

  return {
    close: () => {
      closed = true;
      client?.close();
    },
  };
}

function connectEventSource(
  buttery: string | null,
  onEvent: (type: SSEEventType, data: unknown) => void,
): SSEConnection {
  // Close any existing connection first
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }

  const url = buttery
    ? `${API_BASE_URL}/events?buttery=${encodeURIComponent(buttery)}`
    : `${API_BASE_URL}/events`;

  const eventSource = new EventSource(url);
  activeEventSource = eventSource;

  for (const type of EVENT_TYPES) {
    eventSource.addEventListener(type, (e: MessageEvent) => {
      // Ignore events from stale connections
      if (eventSource !== activeEventSource) return;
      try {
        const data = JSON.parse(e.data);
        onEvent(type, data);
      } catch (err) {
        console.error(`[SSE] Failed to parse ${type} event:`, err);
      }
    });
  }

  eventSource.addEventListener('connected', () => {
    console.log('[SSE] Connected to event stream');
  });

  eventSource.onerror = () => {
    // Only log if this is still the active connection
    if (eventSource === activeEventSource) {
      console.warn('[SSE] Connection error (will auto-reconnect)');
    }
  };

  return {
    close: () => {
      eventSource.close();
      if (activeEventSource === eventSource) {
        activeEventSource = null;
      }
      console.log('[SSE] Connection closed');
    },
  };
}
