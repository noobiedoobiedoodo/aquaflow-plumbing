/**
 * Persistent Object Storage Abstraction
 * Uses AWS S3 / Cloudflare R2 / S3-Compatible object storage in production,
 * and a secure local disk provider for local development.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import mime from 'mime';

export interface FileStorageProvider {
  /**
   * Uploads a file buffer and returns a unique storage key and an access URL.
   */
  uploadFile(
    file: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ storageKey: string; url: string }>;

  /**
   * Deletes a file by its storage key.
   */
  deleteFile(storageKey: string): Promise<void>;

  /**
   * Gets a signed or secure access URL for a storage key.
   */
  getFileUrl(storageKey: string): Promise<string>;

  /**
   * Checks if a file exists in storage.
   */
  fileExists(storageKey: string): Promise<boolean>;

  /**
   * Downloads a file buffer from storage.
   */
  getFileBuffer(storageKey: string): Promise<{ buffer: Buffer; contentType: string } | null>;
}

// ==========================================
// Local File Storage Provider (Development)
// ==========================================
export class LocalFileStorageProvider implements FileStorageProvider {
  private baseDir: string;
  private baseUrl: string;

  constructor() {
    this.baseDir = join(process.cwd(), 'storage', 'private');
    this.baseUrl = '/api/files';

    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(file: Buffer, fileName: string, mimeType: string) {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizedName}`;
    const filePath = join(this.baseDir, uniqueFileName);

    writeFileSync(filePath, file);

    return {
      storageKey: uniqueFileName,
      url: `${this.baseUrl}/${uniqueFileName}`,
    };
  }

  async deleteFile(storageKey: string) {
    const filePath = join(this.baseDir, storageKey);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async getFileUrl(storageKey: string) {
    return `${this.baseUrl}/${storageKey}`;
  }

  async fileExists(storageKey: string): Promise<boolean> {
    const filePath = join(this.baseDir, storageKey);
    return existsSync(filePath);
  }

  async getFileBuffer(storageKey: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const filePath = join(this.baseDir, storageKey);
    if (!existsSync(filePath)) return null;
    const buffer = readFileSync(filePath);
    const contentType = mime.getType(storageKey) || 'application/octet-stream';
    return { buffer, contentType };
  }
}

// ==========================================
// S3 / R2 Persistent Storage Provider (Production)
// ==========================================
export class S3FileStorageProvider implements FileStorageProvider {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucket = process.env.AWS_S3_BUCKET_NAME;

    if (!bucket) {
      throw new Error('AWS_S3_BUCKET_NAME is required for S3FileStorageProvider');
    }

    this.bucket = bucket;

    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region,
    };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    if (process.env.AWS_ENDPOINT) {
      s3Config.endpoint = process.env.AWS_ENDPOINT;
      s3Config.forcePathStyle = true;
    }

    this.s3Client = new S3Client(s3Config);
  }

  async uploadFile(file: Buffer, fileName: string, mimeType: string) {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `uploads/${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizedName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file,
        ContentType: mimeType,
      })
    );

    return {
      storageKey,
      url: `/api/files/${storageKey}`,
    };
  }

  async deleteFile(storageKey: string) {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      })
    );
  }

  async getFileUrl(storageKey: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    // Generate pre-signed URL with 1 hour expiration
    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getFileBuffer(storageKey: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        })
      );

      if (!response.Body) return null;

      const byteArray = await response.Body.transformToByteArray();
      return {
        buffer: Buffer.from(byteArray),
        contentType: response.ContentType || 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }
}

// ==========================================
// Factory Singleton
// ==========================================
export function getStorageProvider(): FileStorageProvider {
  if (process.env.AWS_S3_BUCKET_NAME) {
    return new S3FileStorageProvider();
  }
  const isNextBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !isNextBuildPhase) {
    throw new Error(
      '[Storage Configuration Error]: AWS_S3_BUCKET_NAME is required in production. Local disk storage fallback is forbidden.'
    );
  }
  return new LocalFileStorageProvider();
}

export const storage = getStorageProvider();
