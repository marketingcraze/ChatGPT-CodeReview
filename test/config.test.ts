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
  });

  test('accepts final mode from Action input', () => {
    process.env.INPUT_REVIEW_MODE = 'final';
    expect(loadReviewConfig().mode).toBe('final');
  });

  test('rejects an unpermitted GitNexus release', () => {
    process.env.INPUT_GITNEXUS_VERSION = 'latest';
    expect(() => loadReviewConfig()).toThrow('not permitted');
  });
});
