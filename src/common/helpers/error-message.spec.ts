import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it('reads the message of an Error', () => {
    expect(errorMessage(new Error('connection refused'))).toBe(
      'connection refused',
    );
  });

  it('stringifies anything else that was thrown', () => {
    expect(errorMessage('timeout')).toBe('timeout');
    expect(errorMessage(42)).toBe('42');
  });
});
