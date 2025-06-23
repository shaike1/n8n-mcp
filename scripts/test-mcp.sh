#!/bin/bash

# Test script for N8N MCP Server

set -e

# Allow URL to be passed as argument
if [ $# -eq 1 ]; then
    BASE_URL="$1"
    MCP_URL="${BASE_URL}/mcp"
else
    MCP_URL="${MCP_URL:-http://localhost:3000/mcp}"
    BASE_URL="${MCP_URL%/mcp}"
fi

echo "🧪 Testing N8N MCP Server at: $MCP_URL"

# Test 1: Health Check
echo "1️⃣ Testing health check..."
curl -s -f "${BASE_URL}/health" | jq . || echo "❌ Health check failed"

# Test 2: Initialize MCP Server
echo "2️⃣ Testing MCP initialization..."
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' | jq . || echo "❌ Initialize failed"

# Test 3: List Tools
echo "3️⃣ Testing tools list..."
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }' | jq . || echo "❌ Tools list failed"

# Test 4: Get Workflows (this will fail if N8N is not configured)
echo "4️⃣ Testing get workflows..."
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_workflows",
      "arguments": {}
    }
  }' | jq . || echo "⚠️ Get workflows failed (expected if N8N not configured)"

# Test 5: SSE Connection Test
echo "5️⃣ Testing SSE stream (5 seconds)..."
timeout 5s curl -s -N \
  -H "Accept: text/event-stream" \
  -H "Cache-Control: no-cache" \
  "$MCP_URL" || echo "⚠️ SSE stream test completed"

echo ""
echo "✅ MCP Server tests completed!"
echo "📝 Note: Some tests may fail if N8N is not properly configured."