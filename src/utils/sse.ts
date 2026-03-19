import { API_BASE_URL } from './config';

export type SSEEventType =
  | 'order:created'
  | 'order:updated'
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

  const eventTypes: SSEEventType[] = [
    'order:created',
    'order:updated',
    'menu:created',
    'menu:updated',
    'menu:deleted',
  ];

  for (const type of eventTypes) {
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
