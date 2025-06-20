import { Injectable, Logger } from '@nestjs/common';
import { RawDidDocument } from '@saito/models';
import * as fs from 'fs';
import * as fsAsync from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class DidLocalStorage {
  private readonly logger = new Logger(DidLocalStorage.name);
  private readonly storageDir: string;
  private readonly storagePath: string;

  constructor() {
    // 和 RegistrationStorage 逻辑一致：支持 Docker 和本地
    const dataDir = process.env['SIGHTAI_DATA_DIR'];
    if (dataDir) {
      this.storageDir = path.join(dataDir, 'config');
    } else {
      const homeDir = os.homedir();
      this.storageDir = path.join(homeDir, '.sightai', 'config');
    }
    this.storagePath = path.join(this.storageDir, 'did-local.json');
    this.ensureStorageDir();
  }

  private ensureStorageDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.log(`Created DID storage directory: ${this.storageDir}`);
      }
    } catch (err) {
      this.logger.error(`Failed to create DID storage directory: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async load(): Promise<RawDidDocument | null> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        this.logger.debug('No DID document found');
        return null;
      }
      const data = await fsAsync.readFile(this.storagePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      this.logger.error(`Failed to load DID document: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  }

  async persist(doc: RawDidDocument): Promise<void> {
    try {
      await fsAsync.mkdir(this.storageDir, { recursive: true });
      await fsAsync.writeFile(this.storagePath, JSON.stringify(doc, null, 2), 'utf-8');
      this.logger.log(`DID document persisted at ${this.storagePath}`);
    } catch (err) {
      this.logger.error(`Failed to persist DID document: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }
}