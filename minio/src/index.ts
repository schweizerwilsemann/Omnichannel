
import express from 'express';
import dotenv from 'dotenv';
import { storageService } from './services/storage';
import { singleUpload, multipleUpload } from './controllers/uploadController';
import { listFiles, downloadFile, deleteFile } from './controllers/fileController';
import { healthCheck } from './controllers/healthController';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', healthCheck);

// Upload single file to MinIO
app.post('/upload', ...singleUpload);

// Upload multiple files to MinIO
app.post('/upload-multiple', ...multipleUpload);

// List files in bucket
app.get('/files', listFiles);

// Download file from storage
app.get('/download/:fileName', downloadFile);

// Delete file from storage
app.delete('/files/:fileName', deleteFile);

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Initialize storage bucket
    await storageService.initializeBucket();
    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`📁 Storage client: ${storageService.getClientInfo()}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();