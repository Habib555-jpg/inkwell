import { describe, it, expect } from 'vitest';
import { runAction } from '@/app/_actions/result';
import { NotFoundError } from '@/server/errors';

describe('runAction', () => {
  it('wraps success', async () => { expect(await runAction(async () => 5)).toEqual({ ok: true, data: 5 }); });
  it('maps AppErrors to user-safe messages', async () => {
    expect(await runAction(async () => { throw new NotFoundError('Novel'); })).toEqual({ ok: false, error: 'Novel not found', code: 'not_found' });
  });
  it('hides unexpected error details', async () => {
    const r = await runAction(async () => { throw new Error('db password is hunter2'); });
    expect(r).toEqual({ ok: false, error: 'Something went wrong. Your work was not lost — please retry.', code: 'internal' });
  });
});
