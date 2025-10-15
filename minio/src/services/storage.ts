import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { s3ClientV3, s3ClientV2, bucketNameAWS } from '../config/aws-s3';
import { minioClient, bucketName } from '../config/minio';
import { Readable } from 'stream';

export interface FileUploadResult {
  fileName: string;
  originalName: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
  downloadUrl: string;
}

export interface FileInfo {
  name: string;
  size: number;
  lastModified: Date;
}

class StorageService {
  private useMinIO: boolean;
  private bucket: string;

  constructor() {
    this.useMinIO = process.env.STORAGE_CLIENT === 'minio';
    this.bucket = this.useMinIO ? bucketName : bucketNameAWS;
  }

  // Initialize bucket
  async initializeBucket(): Promise<void> {
    try {
      if (this.useMinIO) {
        // MinIO client
        const bucketExists = await minioClient.bucketExists(this.bucket);
        if (!bucketExists) {
          await minioClient.makeBucket(this.bucket, 'us-east-1');
          console.log(`✅ [MinIO] Bucket "${this.bucket}" created successfully`);
        } else {
          console.log(`✅ [MinIO] Bucket "${this.bucket}" already exists`);
        }
      } else {
        // AWS S3 client
        try {
          await s3ClientV3.send(new HeadBucketCommand({ Bucket: this.bucket }));
          console.log(`✅ [AWS S3] Bucket "${this.bucket}" already exists`);
        } catch (error: any) {
          if (error.name === 'NotFound') {
            await s3ClientV3.send(new CreateBucketCommand({ Bucket: this.bucket }));
            console.log(`✅ [AWS S3] Bucket "${this.bucket}" created successfully`);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error initializing bucket:', error);
      throw error;
    }
  }

  // Upload file
  async uploadFile(fileName: string, fileBuffer: Buffer, contentType: string): Promise<void> {
    if (this.useMinIO) {
      // MinIO client
      // minio.putObject(bucket, objectName, streamOrBuffer, size, metaData?)
      // When passing a Buffer we must also provide its length as the size argument.
      await minioClient.putObject(this.bucket, fileName, fileBuffer, fileBuffer.length, {
        'Content-Type': contentType,
      });
    } else {
      // AWS S3 client
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      });
      await s3ClientV3.send(command);
    }
  }

  // Get file stream
  async getFileStream(fileName: string): Promise<Readable> {
    if (this.useMinIO) {
      // MinIO client
      return await minioClient.getObject(this.bucket, fileName);
    } else {
      // AWS S3 client
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });
      const response = await s3ClientV3.send(command);
      return response.Body as Readable;
    }
  }

  // Get file info
  async getFileInfo(fileName: string): Promise<any> {
    if (this.useMinIO) {
      // MinIO client
      return await minioClient.statObject(this.bucket, fileName);
    } else {
      // AWS S3 client
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });
      return await s3ClientV3.send(command);
    }
  }

  // List files
  async listFiles(): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    if (this.useMinIO) {
      // MinIO client
      return new Promise((resolve, reject) => {
        const stream = minioClient.listObjects(this.bucket, '', true);
        
        stream.on('data', (obj) => {
          files.push({
            name: obj.name!,
            size: obj.size!,
            lastModified: obj.lastModified!
          });
        });
        
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    } else {
      // AWS S3 client
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
      });
      
      const response = await s3ClientV3.send(command);
      
      if (response.Contents) {
        response.Contents.forEach((obj) => {
          if (obj.Key && obj.Size && obj.LastModified) {
            files.push({
              name: obj.Key,
              size: obj.Size,
              lastModified: obj.LastModified
            });
          }
        });
      }
      
      return files;
    }
  }

  // Delete file
  async deleteFile(fileName: string): Promise<void> {
    if (this.useMinIO) {
      // MinIO client
      await minioClient.removeObject(this.bucket, fileName);
    } else {
      // AWS S3 client
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });
      await s3ClientV3.send(command);
    }
  }

  // Get client info
  getClientInfo(): string {
    return this.useMinIO ? 'MinIO Client' : 'AWS S3 Client';
  }
}

export const storageService = new StorageService();