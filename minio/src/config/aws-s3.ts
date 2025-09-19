import { S3Client } from '@aws-sdk/client-s3';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// AWS SDK v3 Client (recommended)
export const s3ClientV3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:9000',
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true', // MinIO requires path-style
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  },
});

// AWS SDK v2 Client (legacy support)
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  region: process.env.AWS_REGION || 'us-east-1',
  s3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
});

export const s3ClientV2 = new AWS.S3({
  endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:9000',
});

export const bucketNameAWS = process.env.MINIO_BUCKET_NAME || 'my-bucket';