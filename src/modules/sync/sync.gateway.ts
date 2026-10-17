import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type Presence = { userId: string; name: string; color: string; pageId: string };

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/sync',
})
export class SyncGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private presence = new Map<string, Presence>();

  handleConnection(client: Socket) {
    client.emit('connected', { id: client.id });
  }

  @SubscribeMessage('joinPage')
  joinPage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; userId: string; name: string },
  ) {
    const room = `page:${data.pageId}`;
    void client.join(room);
    const color = `hsl(${Math.floor(Math.random() * 360)} 70% 45%)`;
    this.presence.set(client.id, {
      userId: data.userId,
      name: data.name,
      color,
      pageId: data.pageId,
    });
    this.broadcastPresence(data.pageId);
    return { ok: true, color };
  }

  @SubscribeMessage('leavePage')
  leavePage(@ConnectedSocket() client: Socket) {
    const p = this.presence.get(client.id);
    this.presence.delete(client.id);
    if (p) this.broadcastPresence(p.pageId);
  }

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

  @SubscribeMessage('yjsUpdate')
  yjsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; update: string },
  ) {
    // Base64 Yjs update relay (Faz 6 lite — room broadcast)
    client.to(`page:${data.pageId}`).emit('yjsUpdate', {
      socketId: client.id,
      update: data.update,
    });
  }

  handleDisconnect(client: Socket) {
    const p = this.presence.get(client.id);
    this.presence.delete(client.id);
    if (p) this.broadcastPresence(p.pageId);
  }

  private broadcastPresence(pageId: string) {
    const list = [...this.presence.values()].filter((p) => p.pageId === pageId);
    this.server.to(`page:${pageId}`).emit('presence', list);
  }
}
