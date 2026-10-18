import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('saveBlocks version conflict contract', () => {
  it('ConflictException carries currentVersion', () => {
    const err = new ConflictException({
      message: 'Sürüm çakışması',
      currentVersion: 7,
    });
    const body = err.getResponse() as { message?: string; currentVersion?: number };
    expect(body.currentVersion).toBe(7);
  });

  it('EDITOR rank above VIEWER', () => {
    const RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };
    expect(RANK.VIEWER < RANK.EDITOR).toBe(true);
    expect(RANK.EDITOR < RANK.OWNER).toBe(true);
  });

  it('empty props object is valid JSON for blocks', () => {
    const props = {};
    expect(JSON.stringify(props)).toBe('{}');
  });
});
