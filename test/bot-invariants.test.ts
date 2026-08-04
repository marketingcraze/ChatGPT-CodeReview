import { eventMatchesMode } from '../src/bot';

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
