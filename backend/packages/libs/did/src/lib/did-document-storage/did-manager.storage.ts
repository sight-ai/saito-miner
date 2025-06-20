import { Injectable, Logger } from '@nestjs/common';
import { ParsedDidDocument } from '@saito/models';
import * as fs from 'fs';
import * as fsAsync from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class DidManagerStorage {
  private readonly logger = new Logger(DidManagerStorage.name);
  private readonly storageDir: string;
  private readonly storagePath: string;

  constructor() {
    // 支持 SIGHTAI_DATA_DIR (Docker) 或本地
    const dataDir = process.env['SIGHTAI_DATA_DIR'];
    if (dataDir) {
      this.storageDir = path.join(dataDir, 'config');
    } else {
      const homeDir = os.homedir();
      this.storageDir = path.join(homeDir, '.sightai', 'config');
    }
    this.storagePath = path.join(this.storageDir, 'did-manager.json');
    this.ensureStorageDir();
  }

  private ensureStorageDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.log(`Created DID manager storage directory: ${this.storageDir}`);
      }
    } catch (err) {
      this.logger.error(`Failed to create DID manager storage directory: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async load(): Promise<ParsedDidDocument[]> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        this.logger.debug('No DID document found');
        return [];
      }
      const data = await fsAsync.readFile(this.storagePath, 'utf-8');
      const arr = JSON.parse(data);
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      this.logger.error(`Failed to load DID documents: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return [];
    }
  }

  async persist(docs: ParsedDidDocument[]): Promise<void> {
    try {
      await fsAsync.mkdir(this.storageDir, { recursive: true });
      await fsAsync.writeFile(this.storagePath, JSON.stringify(docs, null, 2), 'utf-8');
      this.logger.log(`DID manager documents persisted at ${this.storagePath}`);
    } catch (err) {
      this.logger.error(`Failed to persist DID documents: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async persistOne(doc: ParsedDidDocument): Promise<void> {
    const docs = await this.load();
    const idx = docs.findIndex(d => d.id === doc.id);
    if (idx >= 0) {
      docs[idx] = doc;
    } else {
      docs.push(doc);
    }
    await this.persist(docs);
  }

  async loadOne(id: string): Promise<ParsedDidDocument | undefined> {
    const docs = await this.load();
    return docs.find(d => d.id === id);
  }
}