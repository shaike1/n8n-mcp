#!/bin/bash
cd /root
docker stop n8n-mcp-server
docker rm n8n-mcp-server
docker-compose build n8n-mcp-server
docker-compose up -d n8n-mcp-server