import { Request, Response } from 'express';
import { storageService } from '../services/storage';

export const listFiles = async (req: Request, res: Response) => {
  try {
    const files = await storageService.listFiles();
    res.json({ 
      success: true,
      data: { files },
      storageClient: storageService.getClientInfo()
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list files' 
    });
  }
};

export const downloadFile = async (req: Request, res: Response) => {
  try {
    const fileName = req.params.fileName;
    const stat = await storageService.getFileInfo(fileName);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', stat.ContentType || stat.metaData?.['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.ContentLength || stat.size);
    const stream = await storageService.getFileStream(fileName);
    stream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(404).json({ 
      success: false,
      error: 'File not found' 
    });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const fileName = req.params.fileName;
    await storageService.deleteFile(fileName);
    res.json({ 
      success: true,
      message: `File "${fileName}" deleted successfully` 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete file' 
    });
  }
};
