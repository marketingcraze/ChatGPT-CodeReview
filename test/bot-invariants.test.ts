import { eventMatchesMode, publishReviewRun } from '../src/bot';

describe('GitHub event invariants', () => {
  test.each(['opened', 'reopened', 'synchronize'])('initial mode handles %s', (action) => {
    expect(eventMatchesMode({ action, pull_request: { state: 'open' } }, 'initial')).toBe(true);
  });

  test('final mode handles only closed unmerged pull requests', () => {
    expect(eventMatchesMode({ action: 'closed', pull_request: { merged: false } }, 'final')).toBe(true);
    expect(eventMatchesMode({ action: 'closed', pull_request: { merged: true } }, 'final')).toBe(false);
    expect(eventMatchesMode({ action: 'synchronize', pull_request: { merged: false } }, 'final')).toBe(false);
  });
});

describe('review publication invariant', () => {
  test('does not call the GitHub review publisher in silent mode', async () => {
    const publish = jest.fn(async () => undefined);
    await expect(publishReviewRun(false, publish)).resolves.toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

  test('keeps timeline publication enabled by default for compatible callers', async () => {
    const publish = jest.fn(async () => undefined);
    await expect(publishReviewRun(true, publish)).resolves.toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
