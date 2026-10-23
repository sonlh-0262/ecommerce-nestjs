export const REDIS_CLIENT = 'REDIS_CLIENT';

export const LOCK_KEY_PREFIX = 'lock:';

export const LOCK_COMMAND_TIMEOUT_MS = 1000;

export const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;
