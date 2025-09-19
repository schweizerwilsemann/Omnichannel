import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

// MinIO client configuration
export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9001'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

export const bucketName = process.env.MINIO_BUCKET_NAME || 'my-bucket';

// Initialize bucket if it doesn't exist
export const initializeBucket = async (): Promise<void> => {
  try {
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`✅ Bucket "${bucketName}" created successfully`);
    } else {
      console.log(`✅ Bucket "${bucketName}" already exists`);
    }
  } catch (error) {
    console.error('❌ Error initializing bucket:', error);
    throw error;
  }
};