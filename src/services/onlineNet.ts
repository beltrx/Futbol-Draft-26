import mqtt, { type MqttClient } from 'mqtt';
import Peer, { type DataConnection } from 'peerjs';
import type { NetStateSnapshot } from '../types/game';

const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];
const PEER_PREFIX = 'fd2026-p2p-room-';
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  },
};

export interface NetEnvelope {
  type: string;
  _id?: string;
  _from?: 'host' | 'guest';
  _room?: string;
  [key: string]: unknown;
}

type StateListener = (snap: NetStateSnapshot) => void;
type MsgListener = (msg: NetEnvelope) => void;

export function generateRoomCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function getRoomInviteUrl(roomCode: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const u = new URL(window.location.href);
    u.search = `?room=${roomCode}`;
    u.hash = '';
    return u.toString();
  } catch {
    return `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  }
}

export function isPeerReadyForPhase(
  net: NetStateSnapshot,
  phase: string,
  teamIdx: number
): boolean {
  if (!net.connected) return false;
  if (!phase) return !!net.readyMap[teamIdx];
  return net.readyPhase === phase && !!net.readyMap[teamIdx];
}

export class OnlineRoomController {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private mqttClients: MqttClient[] = [];
  private seenIds = new Set<string>();
  private helloTimer: number | null = null;

  public snapshot: NetStateSnapshot = {
    role: null,
    roomCode: '',
    connected: false,
    statusText: 'Bağlı Değil',
    myTeamIdx: 0,
    peerName: '',
    readyPhase: '',
    readyMap: { 0: false, 1: false },
    chatLog: [],
  };

  private stateListeners = new Set<StateListener>();
  private msgListeners = new Set<MsgListener>();

  subscribeState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  subscribeMessages(fn: MsgListener): () => void {
    this.msgListeners.add(fn);
    return () => this.msgListeners.delete(fn);
  }

  private emitState(): void {
    const copy: NetStateSnapshot = {
      ...this.snapshot,
      readyMap: { ...this.snapshot.readyMap },
      chatLog: [...this.snapshot.chatLog],
    };
    this.stateListeners.forEach((fn) => fn(copy));
  }

  updateSnapshot(patch: Partial<NetStateSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
    };
    this.emitState();
  }

  setReady(teamIdx: number, ready: boolean): void {
    this.snapshot.readyMap = { ...this.snapshot.readyMap, [teamIdx]: ready };
    this.emitState();
  }

  setPhaseReady(phase: string, teamIdx: number, ready: boolean): void {
    if (this.snapshot.readyPhase !== phase) {
      this.snapshot.readyPhase = phase;
      this.snapshot.readyMap = { 0: false, 1: false };
    }
    this.snapshot.readyMap = { ...this.snapshot.readyMap, [teamIdx]: ready };
    this.emitState();
  }

  resetReady(nextPhase = ''): void {
    this.snapshot.readyPhase = nextPhase;
    this.snapshot.readyMap = { 0: false, 1: false };
    this.emitState();
  }

  pushChat(sender: string, text: string): void {
    const next = [...this.snapshot.chatLog, { sender, text }];
    if (next.length > 15) next.shift();
    this.snapshot.chatLog = next;
    this.emitState();
  }

  private getRoomTopic(code: string): string {
    return `futboldraft2026/v1/room/${code}`;
  }

  private connectMqtt(code: string, teamName: string): void {
    const topic = this.getRoomTopic(code);
    MQTT_BROKERS.forEach((url, idx) => {
      try {
        const clientId = `fd26_${this.snapshot.role || 'u'}_${idx}_${Math.random().toString(36).slice(2, 8)}`;
        const client = mqtt.connect(url, {
          clientId,
          clean: true,
          connectTimeout: 5000,
          reconnectPeriod: 2000,
        });

        client.on('connect', () => {
          client.subscribe(topic, { qos: 0 }, (err) => {
            if (!err) {
              if (this.snapshot.role === 'host' && !this.snapshot.connected) {
                this.updateSnapshot({
                  statusText: `Oda Hazır (Kod: ${code}) · Arkadaşın bekleniyor...`,
                });
              } else if (this.snapshot.role === 'guest' && !this.snapshot.connected) {
                this.sendHello(teamName);
              }
            }
          });
        });

        client.on('message', (t, payloadBuf) => {
          if (t !== topic) return;
          try {
            const data = JSON.parse(payloadBuf.toString()) as NetEnvelope;
            this.processIncomingEnvelope(data);
          } catch {
            // ignore malformed envelope
          }
        });

        this.mqttClients.push(client);
      } catch {
        // ignore unreachable broker
      }
    });
  }

  private setupPeerConnectionHandlers(conn: DataConnection, teamName: string): void {
    conn.on('open', () => {
      if (this.snapshot.role === 'guest') {
        this.sendHello(teamName);
      }
    });
    conn.on('data', (data) => {
      this.processIncomingEnvelope(data as NetEnvelope);
    });
  }

  public receiveSyntheticMessage(msg: NetEnvelope): void {
    this.processIncomingEnvelope(msg);
  }

  private processIncomingEnvelope(msg: NetEnvelope): void {
    if (!msg || !msg.type) return;
    if (msg._from && msg._from === this.snapshot.role) return;
    if (msg._id) {
      if (this.seenIds.has(msg._id)) return;
      this.seenIds.add(msg._id);
    }
    if (msg.type === 'WELCOME' && this.snapshot.role === 'guest') {
      this.stopHelloLoop();
    }
    this.msgListeners.forEach((fn) => fn(msg));
  }

  private sendHello(teamName: string): void {
    if (this.snapshot.role !== 'guest') return;
    this.send(
      {
        type: 'HELLO',
        name: !teamName || teamName === 'Senin Takımın' || teamName === '1. Oyuncu'
          ? '2. Oyuncu (Misafir)'
          : teamName,
      },
      true
    );
  }

  private startHelloLoop(teamName: string): void {
    this.stopHelloLoop();
    this.sendHello(teamName);
    this.helloTimer = window.setInterval(() => {
      if (this.snapshot.connected || this.snapshot.role !== 'guest') {
        this.stopHelloLoop();
        return;
      }
      this.sendHello(teamName);
    }, 900);
  }

  private stopHelloLoop(): void {
    if (this.helloTimer != null) {
      window.clearInterval(this.helloTimer);
      this.helloTimer = null;
    }
  }

  createRoom(teamName: string): string {
    this.disconnect(true);
    const code = generateRoomCode();
    this.snapshot = {
      role: 'host',
      roomCode: code,
      connected: false,
      statusText: `Oda Kuruldu (${code}) · Arkadaşının bağlanması bekleniyor...`,
      myTeamIdx: 0,
      peerName: '',
      readyPhase: '',
      readyMap: { 0: false, 1: false },
      chatLog: [],
    };
    this.emitState();

    this.connectMqtt(code, teamName);

    try {
      const peer = new Peer(PEER_PREFIX + code, PEER_CONFIG);
      this.peer = peer;
      peer.on('connection', (conn) => {
        this.conn = conn;
        this.setupPeerConnectionHandlers(conn, teamName);
      });
    } catch {
      // PeerJS fallback handled by MQTT
    }

    return code;
  }

  joinRoom(rawCode: string, teamName: string): { ok: boolean; code: string } {
    const trimmed = rawCode.trim();
    const codeMatch = trimmed.match(/(\d{5})/);
    const code = codeMatch ? codeMatch[1] : trimmed.replace(/[^a-zA-Z0-9]/g, '');
    if (!code) return { ok: false, code: '' };

    this.disconnect(true);
    this.snapshot = {
      role: 'guest',
      roomCode: code,
      connected: false,
      statusText: `Oda ${code} ile bağlantı kuruluyor...`,
      myTeamIdx: 1,
      peerName: '',
      readyPhase: '',
      readyMap: { 0: false, 1: false },
      chatLog: [],
    };
    this.emitState();

    this.connectMqtt(code, teamName);
    this.startHelloLoop(teamName);

    try {
      const peer = new Peer(PEER_CONFIG);
      this.peer = peer;
      peer.on('open', () => {
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
        this.conn = conn;
        this.setupPeerConnectionHandlers(conn, teamName);
      });
    } catch {
      // MQTT handles connectivity
    }

    return { ok: true, code };
  }

  send(payload: NetEnvelope, allowBeforeConnected = false): void {
    if (!this.snapshot.role || (!this.snapshot.connected && !allowBeforeConnected)) return;
    const envelope: NetEnvelope = {
      ...payload,
      _id: Math.random().toString(36).slice(2) + '_' + Date.now(),
      _from: this.snapshot.role,
      _room: this.snapshot.roomCode,
    };
    if (envelope._id) this.seenIds.add(envelope._id);

    const topic = this.getRoomTopic(this.snapshot.roomCode);
    const str = JSON.stringify(envelope);
    this.mqttClients.forEach((client) => {
      try {
        if (client.connected) {
          client.publish(topic, str, { qos: 0 });
        }
      } catch {
        // ignore publish failure on individual broker
      }
    });

    if (this.conn && this.conn.open) {
      try {
        this.conn.send(envelope);
      } catch {
        // ignore peer send failure
      }
    }
  }

  disconnect(silent = false): void {
    this.stopHelloLoop();
    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // ignore
      }
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
    }
    this.mqttClients.forEach((c) => {
      try {
        c.end(true);
      } catch {
        // ignore
      }
    });
    this.mqttClients = [];
    this.peer = null;
    this.conn = null;
    this.seenIds.clear();
    this.snapshot = {
      role: null,
      roomCode: '',
      connected: false,
      statusText: 'Bağlı Değil',
      myTeamIdx: 0,
      peerName: '',
      readyPhase: '',
      readyMap: { 0: false, 1: false },
      chatLog: [],
    };
    if (!silent) this.emitState();
  }
}

export const onlineNet = new OnlineRoomController();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__onlineNet = onlineNet;
}


export async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
