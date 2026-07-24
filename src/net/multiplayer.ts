import type { RemotePeerState } from "@/core/types";

interface WireMessage {
  v: 1;
  room: string;
  type: "hello" | "state" | "bye";
  state?: RemotePeerState;
}

export type MultiplayerMode = "offline" | "local" | "websocket";

export interface MultiplayerStatus {
  mode: MultiplayerMode;
  connected: boolean;
  label: string;
  peers: number;
}

export class MultiplayerClient {
  readonly localId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  private room = "lobby";
  private name = "Echo Runner";
  private mode: MultiplayerMode = "offline";
  private channel: BroadcastChannel | null = null;
  private socket: WebSocket | null = null;
  private lastSend = 0;
  private readonly peers = new Map<string, RemotePeerState & { seen: number }>();
  onChange: (peers: RemotePeerState[], status: MultiplayerStatus) => void = () => {};

  get status(): MultiplayerStatus {
    return {
      mode: this.mode,
      connected: this.mode !== "offline",
      label: this.statusLabel(),
      peers: this.livePeers().length,
    };
  }

  configure(room: string, name: string): void {
    this.room = (room || "lobby").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32) || "lobby";
    this.name = (name || "Echo Runner").trim().slice(0, 24) || "Echo Runner";
  }

  connectLocal(): void {
    this.disconnect(false);
    this.mode = "local";
    this.channel = new BroadcastChannel(`echo-maze:${this.room}`);
    this.channel.onmessage = (e) => this.receive(e.data);
    this.post({ v: 1, room: this.room, type: "hello" });
    this.emitChange();
  }

  connectWebSocket(url: string): void {
    this.disconnect(false);
    const clean = url.trim();
    if (!/^wss?:\/\//i.test(clean)) {
      this.mode = "offline";
      this.emitChange("Relay URL must start with ws:// or wss://");
      return;
    }
    this.mode = "websocket";
    this.socket = new WebSocket(clean);
    this.socket.addEventListener("open", () => {
      this.post({ v: 1, room: this.room, type: "hello" });
      this.emitChange();
    });
    this.socket.addEventListener("message", (e) => this.receive(e.data));
    this.socket.addEventListener("close", () => {
      this.mode = "offline";
      this.emitChange("Relay disconnected");
    });
    this.socket.addEventListener("error", () => this.emitChange("Relay error"));
  }

  disconnect(sendBye = true): void {
    if (sendBye) this.post({ v: 1, room: this.room, type: "bye" });
    this.channel?.close();
    this.socket?.close();
    this.channel = null;
    this.socket = null;
    this.mode = "offline";
    this.peers.clear();
    this.emitChange();
  }

  publish(state: RemotePeerState): void {
    if (this.mode === "offline") return;
    const now = performance.now();
    if (now - this.lastSend < 80) return;
    this.lastSend = now;
    this.post({ v: 1, room: this.room, type: "state", state: { ...state, id: this.localId, name: this.name, t: now } });
    this.prune();
  }

  private post(msg: WireMessage): void {
    const raw = JSON.stringify(msg);
    if (this.channel) this.channel.postMessage(raw);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(raw);
  }

  private receive(input: unknown): void {
    let msg: WireMessage | null = null;
    try {
      msg = typeof input === "string" ? JSON.parse(input) : (input as WireMessage);
    } catch {
      return;
    }
    if (!msg || msg.v !== 1 || msg.room !== this.room) return;
    const id = msg.state?.id;
    if (!id || id === this.localId) return;
    if (msg.type === "bye") this.peers.delete(id);
    if (msg.type === "state" && msg.state) this.peers.set(id, { ...msg.state, seen: performance.now() });
    this.emitChange();
  }

  private prune(): void {
    const now = performance.now();
    for (const [id, p] of this.peers) if (now - p.seen > 3500) this.peers.delete(id);
    this.emitChange();
  }

  private livePeers(): RemotePeerState[] {
    const now = performance.now();
    return [...this.peers.values()].filter((p) => now - p.seen < 3500).map(({ seen: _seen, ...p }) => p);
  }

  private statusLabel(extra?: string): string {
    if (extra) return extra;
    if (this.mode === "local") return `Local room: ${this.room}`;
    if (this.mode === "websocket") {
      const ready = this.socket?.readyState;
      if (ready === WebSocket.OPEN) return `Relay room: ${this.room}`;
      if (ready === WebSocket.CONNECTING) return "Connecting relay…";
      return "Relay offline";
    }
    return "Offline";
  }

  private emitChange(extra?: string): void {
    this.onChange(this.livePeers(), { ...this.status, label: this.statusLabel(extra) });
  }
}
