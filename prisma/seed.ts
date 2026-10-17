import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@noteforge.local' },
    update: {},
    create: {
      email: 'admin@noteforge.local',
      fullName: 'NoteForge Admin',
      passwordHash,
    },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { members: { some: { userId: admin.id } } },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Kişisel Workspace',
        members: { create: { userId: admin.id, role: Role.OWNER } },
        pages: {
          create: {
            title: 'Hoş geldin',
            blocks: {
              create: [
                {
                  type: 'paragraph',
                  sortOrder: 1,
                  props: { text: 'NoteForge’a hoş geldin. Boş bir satıra tıkla ve yazmaya başla.' },
                },
                {
                  type: 'heading',
                  sortOrder: 2,
                  props: { level: 2, text: 'Hızlı başlangıç' },
                },
                {
                  type: 'bullet',
                  sortOrder: 3,
                  props: { text: '`/` ile slash menüyü aç' },
                },
                {
                  type: 'bullet',
                  sortOrder: 4,
                  props: { text: 'Görevler için görev paneli veya task bloğu' },
                },
                {
                  type: 'paragraph',
                  sortOrder: 5,
                  props: { text: '' },
                },
              ],
            },
          },
        },
      },
    });
  }

  console.log('Seed OK', { admin: admin.email, workspace: workspace.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
