import { expect, test, describe } from 'vitest';
import { storage } from '../../src/lib/storage';
import { randomUUID } from 'crypto';

describe('Phase 14: Storage Persistence & Lifecycle Verification Suite', () => {
  test('Upload -> Read -> Validate Content -> Delete -> Verify Absence', async () => {
    const testId = randomUUID().slice(0, 8);
    const fileName = `test-persistence-${testId}.png`;
    const payload = Buffer.from('RAW_PNG_BINARY_MOCK_DATA_FOR_PERSISTENCE_TEST', 'utf-8');
    const contentType = 'image/png';

    // 1. Upload
    const uploadResult = await storage.uploadFile(payload, fileName, contentType);
    expect(uploadResult.storageKey).toBeDefined();
    expect(uploadResult.storageKey.length).toBeGreaterThan(0);

    const storageKey = uploadResult.storageKey;

    // 2. Read
    const fileResult = await storage.getFileBuffer(storageKey);
    expect(fileResult).not.toBeNull();
    expect(fileResult?.contentType).toBe(contentType);
    expect(fileResult?.buffer.toString('utf-8')).toBe('RAW_PNG_BINARY_MOCK_DATA_FOR_PERSISTENCE_TEST');

    // 3. Delete
    await storage.deleteFile(storageKey);

    // 4. Verify Absence
    const absentResult = await storage.getFileBuffer(storageKey);
    expect(absentResult).toBeNull();
  });
});
