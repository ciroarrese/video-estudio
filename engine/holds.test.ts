import { describe, expect, it } from 'vitest';
import { holdRender, pendingHolds, releaseRender, waitForHolds } from './holds';

describe('holds', () => {
  it('tracks and releases holds', () => {
    expect(pendingHolds()).toEqual([]);
    const a = holdRender('font');
    const b = holdRender();
    expect(pendingHolds()).toEqual(['font', 'unnamed']);
    releaseRender(a);
    expect(pendingHolds()).toEqual(['unnamed']);
    releaseRender(b);
    releaseRender(b); // idempotent
    expect(pendingHolds()).toEqual([]);
  });
  it('waitForHolds resolves after release and times out otherwise', async () => {
    const h = holdRender('img');
    setTimeout(() => releaseRender(h), 20);
    await waitForHolds();
    expect(pendingHolds()).toEqual([]);
    const h2 = holdRender('stuck');
    await expect(waitForHolds(30)).rejects.toThrow(/stuck/);
    releaseRender(h2);
  });
});
