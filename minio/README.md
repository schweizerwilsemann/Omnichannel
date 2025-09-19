# Express TypeScript MinIO Project

Một project Express.js với TypeScript tích hợp MinIO cho việc lưu trữ và quản lý file.

## Tính năng

- ✅ Express.js server với TypeScript
- ✅ MinIO client integration
- ✅ Upload file API
- ✅ Download file API  
- ✅ List files API
- ✅ Delete file API
- ✅ Docker Compose cho MinIO server

## Cài đặt

### 1. Clone và cài đặt dependencies

```bash
# Tạo thư mục project
mkdir express-minio-project
cd express-minio-project

# Copy các file cấu hình
# (copy tất cả các file từ artifacts)

# Cài đặt dependencies
npm install
```

### 2. Chạy MinIO server

```bash
# Khởi động MinIO bằng Docker Compose
docker-compose up -d

# Kiểm tra logs
docker-compose logs -f minio
```

MinIO Console sẽ chạy tại: http://localhost:9001
- Username: `minioadmin`
- Password: `supersecretpassword`

### 3. Chạy Express server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

Server sẽ chạy tại: http://localhost:3000

## API Endpoints

### 1. Health Check
```bash
GET /health
```

### 2. Upload File
```bash
POST /upload
Content-Type: multipart/form-data

# Example with curl
curl -X POST -F "file=@your-file.jpg" http://localhost:3000/upload
```

### 3. List Files
```bash
GET /files
```

### 4. Download File
```bash
GET /download/:fileName
```

### 5. Delete File
```bash
DELETE /files/:fileName
```

## Cấu hình Environment

File `.env` chứa các cấu hình:

```bash
PORT=3000
MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=my-bucket
```

## Scripts

- `npm run dev` - Chạy development server với nodemon (auto-reload)
- `npm run dev:ts-node-dev` - Alternative development server với ts-node-dev
- `npm run build` - Build TypeScript thành JavaScript
- `npm start` - Chạy production server
- `npm run clean` - Xóa thư mục dist

## Cấu trúc project

```
├── src/
│   ├── config/
│   │   └── minio.ts      # MinIO client configuration
│   └── index.ts          # Main server file
├── dist/                 # Compiled JavaScript
├── docker-compose.yml    # MinIO server setup
├── nodemon.json          # Nodemon configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies
├── .env                  # Environment variables
└── README.md
```

## Test API

Bạn có thể test các API bằng curl hoặc Postman:

```bash
# Upload file
curl -X POST -F "file=@test.jpg" http://localhost:3000/upload

# List files
curl http://localhost:3000/files

# Download file
curl http://localhost:3000/download/1234567890-test.jpg -o downloaded.jpg

# Delete file
curl -X DELETE http://localhost:3000/files/1234567890-test.jpg
```