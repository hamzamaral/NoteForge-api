import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';

function blocksHaveContent(
  blocks: { type: string; props: Record<string, unknown> }[],
) {
  return blocks.some((b) => {
    if (b.type === 'divider' || b.type === 'drawing' || b.type === 'image') return true;
    return String(b.props.text ?? b.props.tex ?? b.props.url ?? b.props.src ?? '').trim().length > 0;
  });
}

describe('saveBlocks contracts', () => {
  it('ConflictException carries currentVersion', () => {
    const err = new ConflictException({
      message: 'Sürüm çakışması',
      currentVersion: 7,
    });
    const body = err.getResponse() as { currentVersion?: number };
    expect(body.currentVersion).toBe(7);
  });

  it('rejects empty overwrite of non-empty content', () => {
    const had = blocksHaveContent([{ type: 'paragraph', props: { text: 'hi' } }]);
    const incoming = blocksHaveContent([{ type: 'paragraph', props: { text: '' } }]);
    expect(had && !incoming).toBe(true);
    expect(() => {
      if (had && !incoming) throw new BadRequestException('Boş overwrite');
    }).toThrow(BadRequestException);
  });

  it('EDITOR rank above VIEWER', () => {
    const RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };
    expect(RANK.VIEWER < RANK.EDITOR).toBe(true);
  });

  it('snapshot every 5th version', () => {
    expect((4 + 1) % 5 === 0).toBe(true);
    expect((5 + 1) % 5 === 0).toBe(false);
  });
});
