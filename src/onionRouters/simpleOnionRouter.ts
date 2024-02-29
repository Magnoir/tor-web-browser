import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair,exportPubKey,exportPrvKey, rsaDecrypt, symDecrypt, importPrvKey } from "../crypto";
export type LastMessageBody = {
    lastReceivedEncryptedMessage: string | null,
    lastReceivedDecryptedMessage: string | null,
    destinationPort: number | null
}

export type LastMessageBodyRegistry = {
  lastMessageRegistry: Map<number, LastMessageBody>
}

export type prvNode = { nodeId: number; prvKey: string | null };

export type GetPrvNodeRegistryBody = {
  nodes: prvNode[];
};
const nodePrvRegistery: GetPrvNodeRegistryBody = {
  nodes: [],
};

const lastMessageRegistry: LastMessageBodyRegistry = {
  lastMessageRegistry: new Map<number, LastMessageBody>()
};

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());
  const keyPair = await generateRsaKeyPair();
  const pubKey = await exportPubKey(keyPair.publicKey);
  const privateKey = await exportPrvKey(keyPair.privateKey);

  nodePrvRegistery.nodes.push({nodeId: nodeId, prvKey: privateKey})

  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  onionRouter.get('/getLastReceivedEncryptedMessage', (req, res) => {
    try {
      const node = lastMessageRegistry.lastMessageRegistry.get(nodeId);
      if (node && node.lastReceivedEncryptedMessage) {
        res.send({ result: node.lastReceivedEncryptedMessage });
      } else {
        res.send({ result: null });
      }
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  onionRouter.get('/getLastReceivedDecryptedMessage', (req, res) => {
    try {
      const node = lastMessageRegistry.lastMessageRegistry.get(nodeId);
      if (node && node.lastReceivedDecryptedMessage) {
        res.send({ result: node.lastReceivedDecryptedMessage });
      } else {
        res.send({ result: null });
      }
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  onionRouter.get('/getLastMessageDestination', (req, res) => {
    try {
      const node = lastMessageRegistry.lastMessageRegistry.get(nodeId);
      if (node && node.destinationPort) {
        res.send({ result: node.destinationPort });
      } else {
        res.send({ result: null });
      }
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  onionRouter.get("/getPrivateKey", (req, res) => {
    try {
        const privateKeyNode = nodePrvRegistery.nodes.find(
        node => node.nodeId === nodeId
      );
      if (privateKeyNode) {
        res.send({ result: privateKeyNode.prvKey });
      } else {
        res.send({ result: null });
      }
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });
  onionRouter.post("/message", async (req, res) => {
    try {
      if (!req.body.message) {
        return res.status(400).send({ error: 'nodeId and message are required' });
      }
      const message = req.body.message;
      const privateKeyNode = nodePrvRegistery.nodes.find(node => node.nodeId === nodeId);
      if (!privateKeyNode) {
        return res.status(404).send({ error: 'Node not found' });
      }
      const decryptedMessage = await decryptMessage(message, privateKeyNode?.prvKey || "");
      const destination = decryptedMessage.slice(0, 10);
      const nextDestination = parseInt(destination);
      const nextMessage = decryptedMessage.slice(10);
      lastMessageRegistry.lastMessageRegistry.set(nodeId, { 
        lastReceivedEncryptedMessage: message, 
        lastReceivedDecryptedMessage: nextMessage,
        destinationPort: nextDestination, 
      });
      const response = await fetch(`http://localhost:${nextDestination}/message`, {
        method: "POST",
        body: JSON.stringify({ message: nextMessage }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Failed to send message to destination: ${response.statusText}`);
      }
      return res.sendStatus(200);
    } catch (error) {
      return res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });
  
  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${
        BASE_ONION_ROUTER_PORT + nodeId
      }`
    );
  });
  await registerNode(nodeId, pubKey);
  return server;
}
async function registerNode(nodeId: number, pubKey: string) {
  fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    body: JSON.stringify({ nodeId, pubKey }),
    headers: { "Content-Type": "application/json" },
  });
}

async function decryptMessage(message: string, privateKey: string) {
  const importedPrivateKey = await importPrvKey(privateKey);
  const decryptedSymKey = await rsaDecrypt(message.slice(0,344), importedPrivateKey);
  const decryptedMessage = await symDecrypt(decryptedSymKey, message.slice(344));
  return decryptedMessage;
}