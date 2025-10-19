-- KEYS[1] = cache key
-- ARGV[1] = answer
-- ARGV[2] = sources JSON
-- ARGV[3] = ttl seconds
-- ARGV[4] = session id (optional)
-- ARGV[5] = question

redis.call('HSET', KEYS[1], 'answer', ARGV[1], 'sources', ARGV[2])

local ttl = tonumber(ARGV[3])
if ttl and ttl > 0 then
  redis.call('EXPIRE', KEYS[1], ttl)
end

if ARGV[4] and ARGV[4] ~= '' then
  local stream_key = 'rag:session:' .. ARGV[4]
  redis.call('XADD', stream_key, '*', 'question', ARGV[5], 'answer', ARGV[1])
  redis.call('XTRIM', stream_key, 'MAXLEN', '~', 200)
end

return 1
