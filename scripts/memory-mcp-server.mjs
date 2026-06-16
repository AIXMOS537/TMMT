#!/usr/bin/env node
/**
 * Memory Fabric — MCP bridge (Phase 2, optional).
 *
 * A thin stdio MCP server that exposes two tools — `remember` and `recall` —
 * to any MCP-aware agent (Claude Code, AIXMOS personas, dispatch CAPTAIN). It
 * does NOT talk to the database directly; it proxies to the app's authenticated
 * /api/memory route, so all access control, validation, and (later) semantic
 * recall live in one place and the backend can be swapped without touching
 * agents.
 *
 * This file is intentionally OUTSIDE the Next.js build. To run it:
 *   npm i @modelcontextprotocol/sdk
 *   MEMORY_API_URL="https://<your-app>/api/memory" \
 *   MEMORY_API_TOKEN="<same token as the app>" \
 *   node scripts/memory-mcp-server.mjs
 *
 * Then register it as an MCP server in the agent's config.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.MEMORY_API_URL;
const API_TOKEN = process.env.MEMORY_API_TOKEN;

if (!API_URL || !API_TOKEN) {
  console.error("Set MEMORY_API_URL and MEMORY_API_TOKEN");
  process.exit(1);
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
  { name: "memory-fabric", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "remember",
      description:
        "Record a memory event into the shared Memory Fabric. Call after doing something meaningful (sent a text, made a decision, updated a record).",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", description: "Verb, e.g. 'sent_sms', 'approved'." },
          source: { type: "string", description: "app|slack|clickup|gmail|quo|calendar|airtable|agent|system" },
          actorKind: { type: "string", description: "ai_agent|operator|team|owner|external|system" },
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
        "Recall the relevant slice of shared memory BEFORE acting. Returns distilled facts first, then a recent event timeline.",
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
  const op = name === "remember" ? "remember" : "recall";
  const out = await callApi({ op, ...(args ?? {}) });
  return { content: [{ type: "text", text: out }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("memory-fabric MCP server running on stdio");
</content>
