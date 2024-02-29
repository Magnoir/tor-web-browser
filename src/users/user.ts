import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT,REGISTRY_PORT,BASE_ONION_ROUTER_PORT } from "../config";
import { GetNodeRegistryBody } from "../registry/registry";
import {createRandomSymmetricKey, symEncrypt, rsaEncrypt, exportSymKey} from "../crypto";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export type ReceivedMessageBody = {
  message: string;
  destinationUserId: number;
};

export type SendMessageBodyRegistry = {
  sendMessageBodyRegistry: SendMessageBody[]
}

export type ReceivedMessageBodyRegistry = {
  receivedMessageBodyRegistry: ReceivedMessageBody[]
}

export type circuitNode = {
  nodeId: number;
  pubKey: string;
}

export type getLastCircuit = {
  nodes: circuitNode[];
}

const sendMessageBodyRegistry: SendMessageBodyRegistry = {
  sendMessageBodyRegistry: [],
};

const receivedMessageBodyRegistry: ReceivedMessageBodyRegistry = {
  receivedMessageBodyRegistry: [],
};

const lastCircuit: getLastCircuit = {
  nodes: [],
};

var nodeRegistry: GetNodeRegistryBody = {
  nodes: [],
};

export async function user(userId: number) {
  await getNodeRegistry();
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  _user.get("/status", (req, res) => {
    res.send("live");
  });
  
  _user.post("/message", (req, res) => {
    try {
      if (!req.body.message) {
        return res.status(400).send({ error: 'Message is required' });
      }
      const { message } = req.body;
      receivedMessageBodyRegistry.receivedMessageBodyRegistry.forEach(
        registry => {
          if(registry.destinationUserId === userId){
            registry.message = message;
          }
        }
      );
      return res.send("success");
    } catch (error) {
      return res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    try {
      const message = receivedMessageBodyRegistry.receivedMessageBodyRegistry.find(
        registry => registry.destinationUserId === userId
      );
      if (message) {
        res.send({ result: message.message || null });
      } else {
        res.send({ result: null });
      }
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  _user.get("/getLastSentMessage", (req, res) => {
    try {
      const message = sendMessageBodyRegistry.sendMessageBodyRegistry.find(
        sendMessageBodyRegistry => sendMessageBodyRegistry.destinationUserId === userId
      );
      if (message) {
        res.send({ result: message.message || null });
      } else {
        res.send({ result: null });
      }
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  _user.get("/getLastCircuit", (req, res) => {
    try {
      const nodeIdTab = lastCircuit.nodes.map(node => node.nodeId).reverse();
      res.send({ result: nodeIdTab });
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  _user.post('/sendMessage', async (req, res) => {
    try {
      const { message, destinationUserId } = req.body;
      const nodes = nodeRegistry.nodes;
      const circuit = await selectNodes(nodes, 3);
      lastCircuit.nodes = circuit;
      var encryptedMessage = message;
      var destinationUserMessage = BASE_USER_PORT+destinationUserId;
      for (const node of circuit) {
        const symmetricKey = await createRandomSymmetricKey();
        const destination = destinationUserMessage.toString().padStart(10, '0')+encryptedMessage;
        destinationUserMessage = BASE_ONION_ROUTER_PORT + node.nodeId;
        const cipher = await symEncrypt(symmetricKey,destination);
        const stepMessage = await rsaEncrypt(await exportSymKey(symmetricKey),node.pubKey);
        encryptedMessage = stepMessage + cipher;
      }
      const entryNode = circuit[2];
      await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + entryNode.nodeId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: encryptedMessage }),
      });
      sendMessageBodyRegistry.sendMessageBodyRegistry.forEach(
        registry => {
          if(registry.destinationUserId === userId){
            registry.message = message;
          }
        }
      );
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
    }
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  sendMessageBodyRegistry.sendMessageBodyRegistry.push({ message: "", destinationUserId: userId });
  if (!receivedMessageBodyRegistry.receivedMessageBodyRegistry.some(existingNode => existingNode.destinationUserId === userId)) {
    receivedMessageBodyRegistry.receivedMessageBodyRegistry.push({ message: "", destinationUserId: userId });
  }
  return server;
}
async function getNodeRegistry() {
  const response = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
  const body = await response.json();
  nodeRegistry = body as GetNodeRegistryBody;
}
async function selectNodes(nodes: any, count: number) {
  const circuit = [];
  const usedIndices = new Set();
  for (let i = 0; i < count; i++) {
    if (usedIndices.size === nodes.length) {
      throw new Error("Not enough unique nodes available");
    }
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * nodes.length);
    } while (usedIndices.has(randomIndex));
    usedIndices.add(randomIndex);
    circuit.push(nodes[randomIndex]);
  }
  return circuit;
}