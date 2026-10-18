import { PrismaClient, Role, SharePermission, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_SHARE_TOKEN = '00000000-0000-4000-8000-0000000000de';

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@noteforge.local' },
    update: { passwordHash, fullName: 'NoteForge Admin' },
    create: {
      email: 'admin@noteforge.local',
      fullName: 'NoteForge Admin',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const editor = await prisma.user.upsert({
    where: { email: 'editor@noteforge.local' },
    update: { passwordHash, fullName: 'Demo Editor' },
    create: {
      email: 'editor@noteforge.local',
      fullName: 'Demo Editor',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@noteforge.local' },
    update: { passwordHash, fullName: 'Demo Viewer' },
    create: {
      email: 'viewer@noteforge.local',
      fullName: 'Demo Viewer',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { members: { some: { userId: admin.id } } },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Demo Workspace',
        members: {
          create: [
            { userId: admin.id, role: Role.OWNER },
            { userId: editor.id, role: Role.EDITOR },
            { userId: viewer.id, role: Role.VIEWER },
          ],
        },
      },
    });
  } else {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: admin.id } },
      create: { workspaceId: workspace.id, userId: admin.id, role: Role.OWNER },
      update: { role: Role.OWNER },
    });
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: editor.id } },
      create: { workspaceId: workspace.id, userId: editor.id, role: Role.EDITOR },
      update: { role: Role.EDITOR },
    });
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: viewer.id } },
      create: { workspaceId: workspace.id, userId: viewer.id, role: Role.VIEWER },
      update: { role: Role.VIEWER },
    });
  }

  let welcome = await prisma.page.findFirst({
    where: { workspaceId: workspace.id, title: 'Hoş geldin', trashedAt: null },
  });
  if (!welcome) {
    welcome = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: 'Hoş geldin',
        icon: '👋',
        blocks: {
          create: [
            {
              type: 'paragraph',
              sortOrder: 1,
              props: { text: 'NoteForge demo — Ctrl+K ara, / slash, @ sayfa linki.' },
            },
            {
              type: 'heading',
              sortOrder: 2,
              props: { level: 2, text: 'Aranabilir içerik: Meilisearch' },
            },
            {
              type: 'bullet',
              sortOrder: 3,
              props: { text: 'İkinci kullanıcı editor@noteforge.local ile collab dene' },
            },
          ],
        },
      },
    });
  }

  let collab = await prisma.page.findFirst({
    where: { workspaceId: workspace.id, title: 'Collab sayfası', trashedAt: null },
  });
  if (!collab) {
    collab = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: 'Collab sayfası',
        icon: '🤝',
        blocks: {
          create: [
            {
              type: 'paragraph',
              sortOrder: 1,
              props: { text: 'İki tarayıcıda aynı anda yaz — Yjs caret + REST kayıt.' },
            },
          ],
        },
      },
    });
  }

  const demoComment = await prisma.comment.findFirst({
    where: { pageId: welcome.id, body: { contains: 'Demo yorum' } },
  });
  if (!demoComment) {
    await prisma.comment.create({
      data: {
        pageId: welcome.id,
        authorId: editor.id,
        body: 'Demo yorum — aramada comment olarak çıkar',
      },
    });
  }

  const demoTask = await prisma.task.findFirst({
    where: { workspaceId: workspace.id, title: 'Demo görev: seed kontrol' },
  });
  if (!demoTask) {
    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        pageId: welcome.id,
        title: 'Demo görev: seed kontrol',
        status: TaskStatus.TODO,
        assigneeId: editor.id,
        dueAt: new Date(Date.now() + 86400_000),
      },
    });
  }

  const existingShare = await prisma.pageShare.findUnique({ where: { token: DEMO_SHARE_TOKEN } });
  if (!existingShare) {
    await prisma.pageShare.create({
      data: {
        workspaceId: workspace.id,
        pageId: welcome.id,
        token: DEMO_SHARE_TOKEN,
        permission: SharePermission.COMMENT,
      },
    });
  }

  console.log('Seed OK', {
    admin: admin.email,
    editor: editor.email,
    viewer: viewer.email,
    workspace: workspace.id,
    share: `/share/${DEMO_SHARE_TOKEN}`,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
