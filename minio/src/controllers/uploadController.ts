import { Request, Response } from 'express';
import { storageService } from '../services/storage';
import multer from 'multer';

// Configure multer for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage() });

export const singleUpload = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded. Please select a file.' 
        });
      }
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const fileBuffer = req.file.buffer;
      const contentType = req.file.mimetype;
      await storageService.uploadFile(fileName, fileBuffer, contentType);
      return res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileName: fileName,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          uploadedAt: new Date().toISOString(),
          downloadUrl: `/download/${fileName}`
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to upload file' 
      });
    }
  }
];

export const multipleUpload = [
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'No files uploaded' 
        });
      }
      const uploadPromises = files.map(async (file) => {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
        await storageService.uploadFile(fileName, file.buffer, file.mimetype);
        return {
          fileName,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          downloadUrl: `/download/${fileName}`
        };
      });
      const uploadedFiles = await Promise.all(uploadPromises);
      return res.json({
        success: true,
        message: `${uploadedFiles.length} files uploaded successfully`,
        data: {
          files: uploadedFiles,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Multiple upload error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to upload files' 
      });
    }
  }
];
