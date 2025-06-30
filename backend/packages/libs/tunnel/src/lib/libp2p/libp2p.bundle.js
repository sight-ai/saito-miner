import { tcp } from '@libp2p/tcp';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify } from '@libp2p/identify';
import { bootstrap } from '@libp2p/bootstrap';
import { createLibp2p } from 'libp2p';
import * as bs58 from '@libp2p/crypto/keys/keys';
import axios from 'axios';
import { multiaddr } from '@multiformats/multiaddr';
import { express, Router } from 'express';
import bodyParser from 'body-parser';
import { privateKeyFromRaw } from '@libp2p/crypto/keys';


var TOPIC = "sight-message";
async function createNode(privateKey, port, onMessage, bootstrapList) {
  const libp2pConfig = {
    privateKey,
    addresses: {
      listen: [`/ip4/127.0.0.1/tcp/${port}`]
    },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      //   ping: ping(),
      //   dht: kadDHT({
      //     // mode: 'server',
      //     clientMode: false,
      //     protocol: "/ipfs/lan/kad/1.0.0",
      //   }),
      pubsub: gossipsub({
        emitSelf: false,
        allowPublishToZeroPeers: true,
        fallbackToFloodsub: false
      }),
      identify: identify()
    }
  };
  if (bootstrapList && bootstrapList.length > 0) {
    libp2pConfig.peerDiscovery = [
      bootstrap({
        list: bootstrapList
      })
    ];
  }
  const node = await createLibp2p(libp2pConfig);
  await node.start();
  console.log(`[libp2p] Node started with PeerId: ${node.peerId.toString()}`);
  const addrs = node.getMultiaddrs().map((a) => a.toString());
  console.log(`[libp2p] Listening on: ${addrs.join(", ")}`);
  await node.services.pubsub.subscribe(TOPIC);
  console.log(`[libp2p] Subscribed to topic: ${TOPIC}`);
  node.services.pubsub.addEventListener("message", (evt) => {
    const msg = new TextDecoder().decode(evt.detail.data);
    try {
      const parsed = JSON.parse(msg);
      onMessage(parsed, evt.detail.from);
    } catch (e) {
      console.error("[libp2p] Received malformed message:", msg);
    }
  });
  return node;
}

function toDid(publicKey) {
  const prefix = new Uint8Array([237, 1]);
  const multicodec = new Uint8Array(prefix.length + publicKey.length);
  multicodec.set(prefix, 0);
  multicodec.set(publicKey, prefix.length);
  return `did:sight:hoster:${bs58.encode(multicodec)}`;
}


var Libp2pNodeService = class {
  constructor(keyPair, nodePort, tunnelAPI, isGateway = false, bootstrapList) {
    this.keyPair = keyPair;
    this.nodePort = nodePort;
    this.tunnelAPI = tunnelAPI;
    this.isGateway = isGateway;
    this.bootstrapList = bootstrapList;
    this.did = isGateway ? "gateway" : toDid(this.keyPair.publicKey);
    console.log(`Did: ${this.did}`);
  }
  node;
  //   private messageHandler: ((msg: any, from: string) => void) | undefined;
  did;
  async initNode() {
    this.node = await createNode(
      privateKeyFromRaw(this.keyPair.secretKey),
      this.nodePort,
      this.handleIncomeMessage.bind(this),
      this.bootstrapList
    );
  }
  async handleIncomeMessage(msg) {
    if (msg.to === this.did) {
      try {
        const res = await axios.post(this.tunnelAPI, msg.payload, {
          headers: { "Content-Type": "application/json" }
        });
        console.log("[Libp2pGateway] Tunnel POST success:", res.data);
      } catch (err) {
        if (err.response) {
          console.error(
            "[Libp2pGateway] Tunnel POST failed:",
            err.response.status,
            err.response.data
          );
        } else {
          console.error("[Libp2pGateway] Tunnel POST error:", err.message);
        }
      }
      console.log("[Libp2pGateway] Matched to address, called tunnel:", msg);
    }
  }
  async handleOutcomeMessage(msg) {
    await this.publish(msg);
    console.log(
      `[Libp2pGateway] Sent message to libp2p network: ${JSON.stringify(
        msg,
        null,
        2
      )}`
    );
  }
  getNode() {
    return this.node;
  }
  async dial(addr) {
    if (!this.node) {
      throw new Error("[Libp2pNodeService] Libp2p node not initialized");
    }
    try {
      const ma = multiaddr(addr);
      await this.node.dial(ma);
      console.log("[Libp2pNodeService] Dialed to", addr);
    } catch (err) {
      console.error("[Libp2pNodeService] Dial error:", err);
      throw err;
    }
  }
  async publish(data) {
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    await this.node.services.pubsub.publish("sight-message", encoded);
  }
  async subscribe(topic) {
    await this.node.services.pubsub.subscribe(topic);
  }
  async unsubscribe(topic) {
    await this.node.services.pubsub.unsubscribe(topic);
  }
};

// src/libp2p-controller.ts
var Libp2pController = class {
  constructor(nodeService) {
    this.nodeService = nodeService;
    this.router = Router();
    this.router.post("/send", async (req, res) => {
      try {
        const tunnelMsg = req.body;
        const libp2pMsg = {
          to: tunnelMsg.to,
          payload: tunnelMsg
        };
        const result = await this.nodeService.handleOutcomeMessage(libp2pMsg);
        res.json({ status: "ok", result });
      } catch (e) {
        res.status(500).json({ status: "error", message: e?.message || "Internal Error" });
      }
    });
  }
  router;
};

// src/main.ts
async function startLibP2PServer(startLibp2pArgs) {
  const {
    expressPort,
    keyPair,
    nodePort,
    tunnelAPI,
    isGateway,
    bootstrapList
  } = startLibp2pArgs;
  const nodeService = new Libp2pNodeService(
    keyPair,
    nodePort,
    tunnelAPI,
    isGateway,
    bootstrapList
  );
  await nodeService.initNode();
  const controller = new Libp2pController(nodeService);
  const app = express();
  app.use(bodyParser.json());
  app.use("/libp2p", controller.router);
  const server = app.listen(expressPort, () => {
    console.log(`Libp2p app started at http://localhost:${expressPort}`);
  });
  const shutdown = async () => {
    console.log("Shutting down server and libp2p node...");
    await nodeService.getNode()?.stop?.();
    server.close(() => {
      console.log("Libp2p server closed.");
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return app;
}

export {
  startLibP2PServer
};
