import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { WorkspaceAccessService } from './workspace.guard';

describe('WorkspaceAccessService role rank', () => {
  const prisma = {
    workspaceMember: {
      findUnique: jest.fn(),
    },
    page: { findUnique: jest.fn() },
  };
  const access = new WorkspaceAccessService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows VIEWER for read minRole', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: Role.VIEWER });
    await expect(access.assertMember('u1', 'w1', Role.VIEWER)).resolves.toBeTruthy();
  });

  it('blocks VIEWER from EDITOR writes', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: Role.VIEWER });
    await expect(access.assertMember('u1', 'w1', Role.EDITOR)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows EDITOR writes', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: Role.EDITOR });
    await expect(access.assertMember('u1', 'w1', Role.EDITOR)).resolves.toBeTruthy();
  });
});
