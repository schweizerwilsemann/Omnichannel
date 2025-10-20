cd chat-infrastructure/rag_service
  redis-cli -u redis://localhost:6379 --eval scripts/lua/clear_rag_cache.lua rag:answer:792b8e03-b79c-4303-8953-
  76f436c6c8cd:*

  - Sau mỗi test, chạy lệnh trên (hoặc dùng rag:answer:* để xóa toàn bộ cache).
  - Tiếp tục ingest và gọi /rag/query sẽ luôn lấy dữ liệu mới.