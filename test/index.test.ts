import { robot } from '../src/bot';

describe('Probot entry point', () => {
  test('exports the managed pull-request event handler', () => {
    expect(typeof robot).toBe('function');
  });
});
