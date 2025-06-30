import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as fsAsync from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
// import nacl from 'tweetnacl';

dotenv.config();

async function bootstrap() {
  // 启动 Nest 应用
  const app = await NestFactory.create(AppModule);

  // 定义本地 keypair 存储路径
  const dataDir = process.env['SIGHTAI_DATA_DIR']
    ? path.join(process.env['SIGHTAI_DATA_DIR'], 'config')
    : path.join(os.homedir(), '.sightai', 'config');
  const keypairPath = path.join(dataDir, 'device-keypair.json');

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      this.logger.log(`Created DID storage directory: ${dataDir}`);
    }
  } catch (err) {
    this.logger.error(`Failed to create DID storage directory: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // 处理 keySeed
  const nacl = await import('tweetnacl');

  let seed: Uint8Array;

  if (fs.existsSync(keypairPath)) {
    // 本地有，直接读取
    const kpStr = await fsAsync.readFile(keypairPath, 'utf-8');
    const kpObj = JSON.parse(kpStr);
    seed = Uint8Array.from(kpObj.seed);
    // 更新 lastUsed 字段
    kpObj.lastUsed = new Date().toISOString();
    await fsAsync.writeFile(keypairPath, JSON.stringify(kpObj, null, 2), 'utf-8');
    console.log(`[KeyPair] Loaded from ${keypairPath}`);
  } else {
    // 本地没有，生成并保存
    seed = nacl.randomBytes(32);
    await fsAsync.mkdir(dataDir, { recursive: true });
    const kpObj = {
      seed: Array.from(seed),
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    await fsAsync.writeFile(
      keypairPath,
      JSON.stringify(kpObj, null, 2),
      'utf-8',
    );
    console.log(`[KeyPair] Generated new and saved to ${keypairPath}`);
  }

  const keyPair = nacl.sign.keyPair.fromSeed(seed);

  const IS_GATEWAY = Number(process.env.IS_GATEWAY) == 1 ? true : false;
  const LIBP2P_PORT = process.env.LIBP2P_PORT
    ? Number(process.env.LIBP2P_PORT)
    : 4010;
  const NODE_PORT = process.env.NODE_PORT
    ? Number(process.env.NODE_PORT)
    : 15050;

  const API_PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8716;
  const BOOTSTRAP_ADDRS = process.env.BOOTSTRAP_ADDRS;
  const bootstrapList = BOOTSTRAP_ADDRS
    ? BOOTSTRAP_ADDRS.split(',')
        .map((addr) => addr.trim())
        .filter(Boolean)
    : [];
  console.log(`bootstrap: ${bootstrapList}`);
  let expressPort = LIBP2P_PORT;
  let nodePort = NODE_PORT;
  let tunnelPort = API_PORT;
  console.log(
    `expressPort: ${expressPort}, nodePort: ${nodePort}, tunnelPort: ${tunnelPort}`,
  );

  // 网关节点端口 +2
  if (IS_GATEWAY) {
    expressPort += 2;
    nodePort += 2;
    tunnelPort += 2;
  }
  console.log(
    `expressPort: ${expressPort}, nodePort: ${nodePort}, tunnelPort: ${tunnelPort}`,
  );

  const tunnelAPI = `http://localhost:${tunnelPort}/libp2p/message`;

  // 组装 options 对象
  const options = {
    expressPort,
    nodePort,
    keyPair,
    tunnelAPI,
    isGateway: IS_GATEWAY,
    bootstrapList: bootstrapList,
  };

  // 动态 import libp2p.bundle.js
  const { startLibP2PServer } = await import('../lib/libp2p.bundle.js'); // 路径视实际存放而定

  // 启动 libp2p
  startLibP2PServer(options);

  // 启动 Nest
  await app.listen(3028);
  console.log('NestJS is running on http://localhost:3028');
}
bootstrap();
