import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEventType =
  | 'order:created'
  | 'order:updated'
  | 'menu:created'
  | 'menu:updated'
  | 'menu:deleted';

export interface RealtimeConnection {
  close: () => void;
}

let activeChannel: RealtimeChannel | null = null;

/**
 * Subscribe to Supabase Realtime for live order and menu updates.
 * Returns a connection object with a close() method for cleanup.
 */
export function connectRealtime(
  buttery: string | null,
  onEvent: (type: RealtimeEventType, data: unknown) => void,
): RealtimeConnection {
  // Close any existing subscription first
  if (activeChannel) {
    console.log('[Realtime] Closing existing channel before reconnecting');
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  console.log('[Realtime] Subscribing to Order and MenuItem changes', { buttery });

  const channel = supabase
    .channel('db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'Order' },
      (payload) => {
        console.log('[Realtime] Order change received:', payload.eventType);
        const type: RealtimeEventType = payload.eventType === 'INSERT' ? 'order:created' : 'order:updated';
        onEvent(type, payload.new);
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'MenuItem' },
      (payload) => {
        console.log('[Realtime] MenuItem change received:', {
          eventType: payload.eventType,
          old: payload.old,
          new: payload.new,
        });
        let type: RealtimeEventType;
        if (payload.eventType === 'INSERT') {
          type = 'menu:created';
        } else if (payload.eventType === 'DELETE') {
          type = 'menu:deleted';
        } else {
          type = 'menu:updated';
        }
        console.log('[Realtime] Dispatching event:', type);
        onEvent(type, payload.new);
      },
    )
    .subscribe((status, err) => {
      console.log('[Realtime] Channel status:', status, err ? `Error: ${err.message}` : '');
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Successfully subscribed to Supabase Realtime');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel error:', err);
      } else if (status === 'TIMED_OUT') {
        console.error('[Realtime] Subscription timed out');
      } else if (status === 'CLOSED') {
        console.warn('[Realtime] Channel closed');
      }
    });

  activeChannel = channel;

  return {
    close: () => {
      supabase.removeChannel(channel);
      if (activeChannel === channel) {
        activeChannel = null;
      }
      console.log('[Realtime] Connection closed');
    },
  };
}
