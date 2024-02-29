import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { 
  nodeId: number; 
  pubKey: string 
};

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

const nodeRegistery: GetNodeRegistryBody = {
  nodes: [],
};

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  _registry.post("/registerNode", (req, res) => {
    try {
      const { nodeId, pubKey } = req.body;
      const node: Node = { nodeId, pubKey };
      if (!nodeRegistery.nodes.some(existingNode => existingNode.nodeId === node.nodeId)) {
        nodeRegistery.nodes.push(node);
      }
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: 'An unexpected error occurred' });
  }
  });

  _registry.get("/getNodeRegistry", (req, res) => {
    res.send(nodeRegistery);
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}