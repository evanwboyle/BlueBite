import WebSocket from "ws";
import { CloverWebSocketInterface } from "remote-pay-cloud";

/**
 * remote-pay-cloud ships a browser WebSocket implementation only. Its own
 * source explicitly recommends `ws` for non-browser (Node) environments:
 * see CloverWebSocketInterface.connect()'s error message. This mirrors
 * BrowserWebSocketImpl.createWebSocket() exactly, just backed by `ws`.
 */
export class NodeCloverWebSocketImpl extends CloverWebSocketInterface {
  constructor(endpoint: string) {
    super(endpoint);
  }

  createWebSocket(endpoint: string, accessToken?: string): unknown {
    // Clover reads the OAuth access token off the Sec-WebSocket-Protocol
    // header, so it's passed as the `protocols` argument here - same as
    // BrowserWebSocketImpl does with `new WebSocket(endpoint, accessToken)`.
    return new WebSocket(endpoint, accessToken);
  }

  // Neither the browser implementation nor ours bothers with raw ping/pong
  // frames; CloverDeviceConfiguration's heartbeat is disabled by default
  // (heartbeatInterval = -1) unless explicitly configured.
  sendPong(): CloverWebSocketInterface {
    return this;
  }

  sendPing(): CloverWebSocketInterface {
    return this;
  }

  static createInstance(endpoint: string): NodeCloverWebSocketImpl {
    return new NodeCloverWebSocketImpl(endpoint);
  }
}
