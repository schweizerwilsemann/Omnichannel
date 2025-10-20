-- Args:
--   KEYS[1] - pattern for keys to delete (supports glob-style, e.g., "rag:answer:*")
--
-- Returns:
--   Number of keys deleted.

local cursor = "0"
local deleted = 0
repeat
    local scan_result = redis.call("SCAN", cursor, "MATCH", KEYS[1], "COUNT", 100)
    cursor = scan_result[1]
    local keys = scan_result[2]
    if #keys > 0 then
        redis.call("DEL", unpack(keys))
        deleted = deleted + #keys
    end
until cursor == "0"

return deleted
