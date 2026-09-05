/**
 * The single WebSocket the client keeps open to the host.
 *
 * Stores subscribe to the events they care about rather than importing each
 * other, which keeps the module graph acyclic: this file imports nothing from
 * the feature stores.
 */

import {
  buildWsUrl,
  HandoutForceOpenMessage,
  HandoutUpdateMessage,
  RpcMethod,
  type ConnectionStatus,
  type LanPlayer,
  type RpcResults,
  type ServerMessage,
  type SessionStateMessage,
  type SheetUpdateMessage,
} from './protocol';

const RECONNECT_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

export interface Identity {
  clientId: string;
  username: string;
  color: string;
}

/** Events any store can subscribe to. */
export interface LanEvents {
  status: ConnectionStatus;
  roster: LanPlayer[];
  session: SessionStateMessage;
  sheet: SheetUpdateMessage;
  /** A chat or roll payload, forwarded verbatim. */
  chat: Record<string, unknown>;
  closed: string;
  handout: HandoutUpdateMessage;
  handoutForceOpen: HandoutForceOpenMessage;
}

type Listener<K extends keyof LanEvents> = (payload: LanEvents[K]) => void;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

class LanConnection {
  private socket: WebSocket | null = null;
  private identity: Identity | null = null;
  private address: string | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Map<keyof LanEvents, Set<Listener<never>>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set while the user is deliberately leaving, to suppress auto-reconnect. */
  private closing = false;
  private status: ConnectionStatus = 'idle';

  on<K extends keyof LanEvents>(event: K, listener: Listener<K>): () => void {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(listener as Listener<never>);
    return () => {
      bucket?.delete(listener as Listener<never>);
    };
  }

  private emit<K extends keyof LanEvents>(event: K, payload: LanEvents[K]) {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    for (const listener of bucket) {
      try {
        (listener as Listener<K>)(payload);
      } catch (error) {
        console.error(`LAN listener for "${String(event)}" threw`, error);
      }
    }
  }

  getStatus() {
    return this.status;
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.emit('status', status);
  }

  isOpen() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect, or update our identity on an already-open socket. Calling this
   * repeatedly with the same address is safe.
   */
  connect(address: string, identity: Identity) {
    this.identity = identity;
    this.closing = false;

    if (this.address === address && this.socket) {
      const state = this.socket.readyState;
      if (state === WebSocket.OPEN) {
        this.announce();
        return;
      }
      if (state === WebSocket.CONNECTING) return;
    }

    this.address = address;
    this.openSocket();
  }

  private openSocket() {
    if (!this.address || !this.identity) return;

    this.clearReconnect();
    this.setStatus(this.status === 'offline' ? 'reconnecting' : 'connecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(buildWsUrl(this.address));
    } catch (error) {
      console.error('Could not open the LAN socket', error);
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      this.setStatus('online');
      this.announce();
    };

    socket.onmessage = (event) => this.receive(event.data);

    socket.onerror = () => {
      // `onclose` always follows, so recovery is handled in one place.
      console.warn('LAN socket error');
    };

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.failPending(new Error('A conexão com o mestre foi perdida.'));
      if (this.closing) {
        this.setStatus('idle');
        return;
      }
      this.setStatus('offline');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closing || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Announce identity. The host treats a repeat `join` from a known client id
   * as a session restore, so this is also what makes reconnects seamless.
   */
  private announce() {
    if (!this.identity) return;
    this.send({
      type: 'join',
      clientId: this.identity.clientId,
      username: this.identity.username,
      color: this.identity.color,
    });
  }

  updateIdentity(identity: Identity) {
    this.identity = identity;
    if (this.isOpen()) this.announce();
  }

  disconnect() {
    this.closing = true;
    this.clearReconnect();
    this.failPending(new Error('A sessão foi encerrada.'));
    const socket = this.socket;
    this.socket = null;
    this.address = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    this.setStatus('idle');
  }

  send(message: unknown): boolean {
    if (!this.isOpen()) return false;
    try {
      this.socket?.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send over the LAN socket', error);
      return false;
    }
  }

  claimSheet(clientId: string, sheetId: string) {
    this.send({ type: 'claim', clientId, sheetId });
  }

  releaseSheet(clientId: string) {
    this.send({ type: 'release', clientId });
  }

  /** Call a method on the host and wait for its answer. */
  request<M extends keyof RpcResults>(
    method: M,
    params: Record<string, unknown> = {}
  ): Promise<RpcResults[M]> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {
        reject(new Error('Sem conexão com o mestre.'));
        return;
      }
      const requestId = newId();
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`O mestre não respondeu a "${method}".`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      const sent = this.send({ type: 'rpc', requestId, method, params });
      if (!sent) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(new Error('Sem conexão com o mestre.'));
      }
    });
  }

  private failPending(reason: Error) {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(reason);
    }
    this.pending.clear();
  }

  private receive(raw: unknown) {
    if (typeof raw !== 'string') return;

    let message: ServerMessage | (Record<string, unknown> & { type?: string });
    try {
      message = JSON.parse(raw);
    } catch (error) {
      console.error('Discarding an unparsable LAN message', error);
      return;
    }

    switch (message.type) {
      case 'rpc_result': {
        const result = message as Extract<
          ServerMessage,
          { type: 'rpc_result' }
        >;
        const entry = this.pending.get(result.requestId);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.pending.delete(result.requestId);
        if (result.ok) entry.resolve(result.data);
        else entry.reject(new Error(result.error ?? 'Falha no pedido.'));
        return;
      }
      case 'roster_sync':
        this.emit(
          'roster',
          (message as Extract<ServerMessage, { type: 'roster_sync' }>).players
        );
        return;
      case 'session_state': {
        const session = message as SessionStateMessage;
        this.emit('session', session);
        this.emit('roster', session.players);
        return;
      }
      case 'sheet_update':
        this.emit('sheet', message as SheetUpdateMessage);
        return;
      case 'session_closed':
        this.emit(
          'closed',
          (message as Extract<ServerMessage, { type: 'session_closed' }>).reason
        );
        return;
      case 'text':
      case 'roll':
        this.emit('chat', message as Record<string, unknown>);
        return;
      case 'handout_update':
        this.emit('handout', message as HandoutUpdateMessage);
        return;
      case 'handout_force_open':
        this.emit('handoutForceOpen', message as HandoutForceOpenMessage);
        return;
      default:
        console.warn('Ignoring an unknown LAN message type', message.type);
    }
  }
}

/** One connection per application instance. */
export const lan = new LanConnection();

export { RpcMethod };
