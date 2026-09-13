import {
  buildWsUrl,
  CurtainClientMessage,
  CurtainSyncMessage,
  HandoutForceOpenMessage,
  HandoutUpdateMessage,
  JukeboxSyncMessage,
  RpcMethod,
  ToolClientMessage,
  ToolSyncMessage,
  type ConnectionStatus,
  type LanPlayer,
  type MapsUpdateMessage,
  type RpcResults,
  type ServerMessage,
  type SessionStateMessage,
  type SheetUpdateMessage,
  type TokenClientMessage,
  type TokenMovedMessage,
  type TokensSyncMessage,
} from './protocol';

const REQUEST_TIMEOUT_MS = 15000;

/** How often a liveness probe is sent while the socket looks open. */
const HEARTBEAT_INTERVAL_MS = 5000;
/** No reply within this window means the socket is dead but not yet closed. */
const HEARTBEAT_TIMEOUT_MS = 14000;

const RECONNECT_MIN_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10000;

/** How long a call will sit waiting for the socket to come back. */
const SOCKET_WAIT_MS = 12000;
const SOCKET_POLL_MS = 150;

/**
 * Raised when the socket is down. Callers can tell this apart from a refusal
 * the host actually sent back.
 */
export class LanOffline extends Error {
  constructor(message = 'Sem conexão com o mestre.') {
    super(message);
    this.name = 'LanOffline';
  }
}

export interface Identity {
  clientId: string;
  username: string;
  color: string;
}

export interface LanEvents {
  status: ConnectionStatus;
  roster: LanPlayer[];
  session: SessionStateMessage;
  sheet: SheetUpdateMessage;
  chat: Record<string, unknown>;
  closed: string;
  handout: HandoutUpdateMessage;
  handoutForceOpen: HandoutForceOpenMessage;
  maps: MapsUpdateMessage;
  tokens: TokensSyncMessage;
  tokenMoved: TokenMovedMessage;
  tool: ToolSyncMessage;
  jukeboxSync: JukeboxSyncMessage;
  curtain: CurtainSyncMessage;
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
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = 0;
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
      this.reconnectAttempts = 0;
      this.setStatus('online');
      this.announce();
      this.startHeartbeat();
    };

    socket.onmessage = (event) => this.receive(event.data);

    socket.onerror = () => {
      console.warn('LAN socket error');
    };

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.stopHeartbeat();
      this.failPending(new LanOffline('A conexão com o mestre foi perdida.'));
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
    const delay = Math.min(
      RECONNECT_MIN_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * A half-open socket looks healthy to the browser but never delivers
   * anything, which is why a player could sit there unable to roll until they
   * rejoined. Probe it and recycle it the moment the host stops answering.
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastPongAt = Date.now();
    this.heartbeatTimer = setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        console.warn('The host stopped answering; recycling the LAN socket.');
        this.stopHeartbeat();
        socket.close();
        return;
      }

      try {
        socket.send(JSON.stringify({ type: 'ping' }));
      } catch (error) {
        console.warn('Heartbeat could not be sent', error);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Skip the remaining backoff; something needs the socket right now. */
  private reconnectNow() {
    if (this.closing || !this.address) return;
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) return;
    this.clearReconnect();
    this.openSocket();
  }

  private waitForSocket(timeoutMs: number): Promise<void> {
    if (this.isOpen()) return Promise.resolve();
    if (this.closing || !this.address) {
      return Promise.reject(new LanOffline());
    }

    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = setInterval(() => {
        if (this.isOpen()) {
          clearInterval(tick);
          resolve();
          return;
        }
        if (this.closing || Date.now() - started > timeoutMs) {
          clearInterval(tick);
          reject(new LanOffline());
        }
      }, SOCKET_POLL_MS);
    });
  }

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
    this.stopHeartbeat();
    this.reconnectAttempts = 0;
    this.failPending(new LanOffline('A sessão foi encerrada.'));
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

  sendToken(message: TokenClientMessage) {
    this.send(message);
  }

  sendTool(message: ToolClientMessage) {
    this.send(message);
  }

  sendCurtain(message: CurtainClientMessage) {
    this.send(message);
  }

  /**
   * Gives a dropped connection a chance to come back before giving up, so a
   * blip no longer costs the player their roll. The wait happens *before* the
   * request leaves, never after, so nothing can be applied twice.
   */
  async request<M extends keyof RpcResults>(
    method: M,
    params: Record<string, unknown> = {}
  ): Promise<RpcResults[M]> {
    if (!this.isOpen()) {
      this.reconnectNow();
      await this.waitForSocket(SOCKET_WAIT_MS);
    }
    return this.dispatch(method, params);
  }

  private dispatch<M extends keyof RpcResults>(
    method: M,
    params: Record<string, unknown>
  ): Promise<RpcResults[M]> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {
        reject(new LanOffline());
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
        reject(new LanOffline());
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
      case 'pong':
        this.lastPongAt = Date.now();
        return;
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
      case 'maps_update':
        this.emit('maps', message as MapsUpdateMessage);
        return;
      case 'tokens_sync':
        this.emit('tokens', message as TokensSyncMessage);
        return;
      case 'token_moved':
        this.emit('tokenMoved', message as TokenMovedMessage);
        return;
      case 'tool_sync':
        this.emit('tool', message as ToolSyncMessage);
        return;
      case 'jukebox_sync':
        this.emit('jukeboxSync', message as JukeboxSyncMessage);
        return;
      case 'curtain_sync':
        this.emit('curtain', message as CurtainSyncMessage);
        return;
      default:
        console.warn('Ignoring an unknown LAN message type', message.type);
    }
  }
}

export const lan = new LanConnection();

export { RpcMethod };
