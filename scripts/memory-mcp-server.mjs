#!/usr/bin/env node
/**
 * Memory Fabric — MCP bridge + X profile reader.
 * Proxies remember/recall to /api/memory; exposes x_profile for owner identity.
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.MEMORY_API_URL;
const API_TOKEN = process.env.MEMORY_API_TOKEN;
const X_PROFILE = process.env.HAILMARY_X_PROFILE || join(homedir(), ".hailmary", "X-PROFILE.md");

if (!API_URL || !API_TOKEN) {
  console.error("Set MEMORY_API_URL and MEMORY_API_TOKEN");
  process.exit(1);
}

function readXProfile() {
  if (!existsSync(X_PROFILE)) {
    return `(X profile missing — create ${X_PROFILE})`;
  }
  return readFileSync(X_PROFILE, "utf8").slice(0, 8000);
}

async function callApi(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`memory api ${res.status}: ${text}`);
  return text;
}

const server = new Server(
  { name: "memory-fabric", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "x_profile",
      description:
        "Read the owner's X profile (GHOST/X/HAILMARY identity, missions, guardrails). Call BEFORE acting on owner tasks.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "remember",
      description:
        "Record a memory event. Call AFTER meaningful actions. Include actorLabel from X profile callsign when possible.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string" },
          source: { type: "string" },
          actorKind: { type: "string" },
          actorLabel: { type: "string" },
          entityId: { type: "string" },
          summary: { type: "string" },
          details: { type: "object" },
          dedupeKey: { type: "string" },
        },
        required: ["action"],
      },
    },
    {
      name: "recall",
      description:
        "Recall shared memory BEFORE acting. Pair with x_profile for full owner context.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          entityId: { type: "string" },
          actorKind: { type: "string" },
          source: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "x_profile") {
    return { content: [{ type: "text", text: readXProfile() }] };
  }
  const op = name === "remember" ? "remember" : "recall";
  const out = await callApi({ op, ...(args ?? {}) });
  return { content: [{ type: "text", text: out }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("memory-fabric MCP server running on stdio (x_profile + remember + recall)");
