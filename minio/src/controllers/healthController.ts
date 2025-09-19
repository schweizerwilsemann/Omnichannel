import { Request, Response } from 'express';
import { storageService } from '../services/storage';

export const healthCheck = (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    storageClient: storageService.getClientInfo(),
    timestamp: new Date().toISOString()
  });
};
