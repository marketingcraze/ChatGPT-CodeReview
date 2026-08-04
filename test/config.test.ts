import { loadReviewConfig, PERMITTED_GITNEXUS_VERSION } from '../src/config';

describe('managed configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('INPUT_')) delete process.env[key];
    }
    delete process.env.REVIEW_MODE;
    delete process.env.GITNEXUS_VERSION;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('defaults to the staged managed contract', () => {
    const config = loadReviewConfig();
    expect(config.mode).toBe('initial');
    expect(config.gitnexusVersion).toBe(PERMITTED_GITNEXUS_VERSION);
    expect(config.initialModel).toBe('gpt-5.6-luna');
    expect(config.validationModel).toBe('gpt-5.6-terra');
    expect(config.escalationModel).toBe('gpt-5.6-sol');
    expect(config.publishReviewComment).toBe(true);
    expect(config.previousReviewRunPath).toBeUndefined();
  });

  test('accepts final mode from Action input', () => {
    process.env.INPUT_REVIEW_MODE = 'final';
    expect(loadReviewConfig().mode).toBe('final');
  });

  test('rejects an unpermitted GitNexus release', () => {
    process.env.INPUT_GITNEXUS_VERSION = 'latest';
    expect(() => loadReviewConfig()).toThrow('not permitted');
  });

  test('supports a silent review and an exact-SHA previous run file', () => {
    process.env.INPUT_PUBLISH_REVIEW_COMMENT = 'false';
    process.env.INPUT_PREVIOUS_REVIEW_RUN_PATH = '.trusted-state/initial-review.json';
    const config = loadReviewConfig();
    expect(config.publishReviewComment).toBe(false);
    expect(config.previousReviewRunPath).toBe('.trusted-state/initial-review.json');
  });

  test('rejects an ambiguous boolean input', () => {
    process.env.INPUT_PUBLISH_REVIEW_COMMENT = 'yes';
    expect(() => loadReviewConfig()).toThrow('Expected true or false');
  });
});
