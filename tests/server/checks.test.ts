import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown } from '../helpers/fixtures';
import { generateDraft } from '@/server/pipeline/generate';
import { checkVersion } from '@/server/pipeline/checks';
import { createChapter } from '@/server/services/chapters';
import { NotFoundError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });

describe('draft checks', () => {
  it('generation stores continuity and critic reports', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'Mira scouts the harbor', requiredEvents: ['Mira scouts the harbor'], characterIds: [w.mira.id] });
    const { version } = await generateDraft(ctx, u.id, ch.id);
    const cont = version.continuityReport as { issues: unknown[]; aiReviewed: boolean };
    const crit = version.criticReport as { metrics: { wordCount: number } };
    expect(Array.isArray(cont.issues)).toBe(true);
    expect(cont.aiReviewed).toBe(false); // local provider: rules only
    expect(crit.metrics.wordCount).toBeGreaterThan(0);
  });
  it('on-demand check is owner-scoped', async () => {
    const u = await makeUser(ctx.db); const o = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'x', requiredEvents: ['x happens'] });
    const { version } = await generateDraft(ctx, u.id, ch.id);
    await expect(checkVersion(ctx, o.id, version.id)).rejects.toBeInstanceOf(NotFoundError);
    const r = await checkVersion(ctx, u.id, version.id);
    expect(r.continuity.issues).toBeDefined();
  });
});
