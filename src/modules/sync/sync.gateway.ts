import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';

type Presence = {
  userId: string;
  name: string;
  color: string;
  pageId: string;
  socketId: string;
};

const COLORS = ['#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#15803d', '#a21caf', '#c2410c'];

function colorFor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function b64ToUint8(b64: string) {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function uint8ToB64(u8: Uint8Array) {
  return Buffer.from(u8).toString('base64');
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/sync',
})
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SyncGateway.name);
  private presence = new Map<string, Presence>();
  private rooms = new Map<string, Y.Doc>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ||
        (typeof client.handshake.headers.authorization === 'string'
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : undefined);
      if (!raw) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(raw, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      client.data.user = { userId: payload.sub, email: payload.email };
      client.emit('connected', { id: client.id, userId: payload.sub });
    } catch {
      this.logger.warn(`sync reject ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.leaveAll(client);
  }

  @SubscribeMessage('joinPage')
  joinPage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; name?: string },
  ) {
    const user = client.data.user as { userId: string; email: string } | undefined;
    if (!user?.userId || !data?.pageId) return { ok: false };

    const prev = this.presence.get(client.id);
    if (prev && prev.pageId !== data.pageId) {
      void client.leave(`page:${prev.pageId}`);
      this.presence.delete(client.id);
      this.broadcastPresence(prev.pageId);
    }

    const room = `page:${data.pageId}`;
    void client.join(room);
    const color = colorFor(user.userId);
    const name = data.name?.trim() || user.email;
    this.presence.set(client.id, {
      userId: user.userId,
      name,
      color,
      pageId: data.pageId,
      socketId: client.id,
    });
    this.broadcastPresence(data.pageId);

    // Seed sync: send current room state to joiner
    const doc = this.getDoc(data.pageId);
    const update = Y.encodeStateAsUpdate(doc);
    client.emit('yjsSync', { pageId: data.pageId, update: uint8ToB64(update) });

    return { ok: true, color };
  }

  @SubscribeMessage('leavePage')
  leavePage(@ConnectedSocket() client: Socket) {
    this.leaveAll(client);
  }

  @SubscribeMessage('yjsSync')
  yjsSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; stateVector?: string },
  ) {
    if (!this.presence.get(client.id) || !data?.pageId) return { ok: false };
    const doc = this.getDoc(data.pageId);
    const update = data.stateVector
      ? Y.encodeStateAsUpdate(doc, b64ToUint8(data.stateVector))
      : Y.encodeStateAsUpdate(doc);
    return { ok: true, update: uint8ToB64(update) };
  }

  @SubscribeMessage('yjsUpdate')
  yjsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; update: string },
  ) {
    const p = this.presence.get(client.id);
    if (!p || p.pageId !== data.pageId || !data.update) return;
    try {
      const doc = this.getDoc(data.pageId);
      Y.applyUpdate(doc, b64ToUint8(data.update));
    } catch (e) {
      this.logger.warn(`yjs apply failed: ${String(e)}`);
      return;
    }
    client.to(`page:${data.pageId}`).emit('yjsUpdate', {
      socketId: client.id,
      update: data.update,
    });
  }

  @SubscribeMessage('awarenessUpdate')
  awarenessUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; update: string },
  ) {
    const p = this.presence.get(client.id);
    if (!p || p.pageId !== data.pageId || !data.update) return;
    client.to(`page:${data.pageId}`).emit('awarenessUpdate', {
      socketId: client.id,
      update: data.update,
    });
  }

  /** Legacy lite cursor beacon (kept for non-Yjs UI hints) */
  @SubscribeMessage('awareness')
  awareness(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; cursor?: { x: number; y: number }; blockId?: string },
  ) {
    client.to(`page:${data.pageId}`).emit('awareness', {
      socketId: client.id,
      ...data,
      presence: this.presence.get(client.id),
    });
  }

  private getDoc(pageId: string) {
    let doc = this.rooms.get(pageId);
    if (!doc) {
      doc = new Y.Doc();
      this.rooms.set(pageId, doc);
    }
    return doc;
  }

  private leaveAll(client: Socket) {
    const p = this.presence.get(client.id);
    this.presence.delete(client.id);
    if (p) {
      void client.leave(`page:${p.pageId}`);
      this.broadcastPresence(p.pageId);
      // Drop empty room docs after last peer leaves (memory)
      const still = [...this.presence.values()].some((x) => x.pageId === p.pageId);
      if (!still) {
        const doc = this.rooms.get(p.pageId);
        doc?.destroy();
        this.rooms.delete(p.pageId);
      }
    }
  }

  private broadcastPresence(pageId: string) {
    const list = [...this.presence.values()].filter((p) => p.pageId === pageId);
    this.server.to(`page:${pageId}`).emit('presence', list);
  }
}
