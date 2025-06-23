#!/usr/bin/env node

const https = require('https');
const { URL } = require('url');

// Configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://n8n-mcp.right-api.com';
const API_TOKEN = process.env.API_TOKEN || 'your-api-token-here';

class MCPClient {
    constructor(serverUrl, token) {
        this.serverUrl = new URL(serverUrl);
        this.token = token;
        this.requestId = 1;
    }

    async sendRequest(method, params = null) {
        return new Promise((resolve, reject) => {
            const requestData = {
                jsonrpc: '2.0',
                id: this.requestId++,
                method: method
            };
            
            if (params) {
                requestData.params = params;
            }

            const postData = JSON.stringify(requestData);
            
            const options = {
                hostname: this.serverUrl.hostname,
                port: this.serverUrl.port || 443,
                path: this.serverUrl.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'n8n-mcp-test-client/1.0.0'
                }
            };

            console.log(`\n→ Sending ${method} request to ${this.serverUrl.href}`);
            console.log('Headers:', JSON.stringify(options.headers, null, 2));
            console.log('Body:', postData);

            const req = https.request(options, (res) => {
                let data = '';
                
                console.log(`← Response status: ${res.statusCode}`);
                console.log('Response headers:', JSON.stringify(res.headers, null, 2));
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log('Response body:', data);
                    
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(`MCP Error: ${response.error.message} (code: ${response.error.code})`));
                        } else {
                            resolve(response.result);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}\nRaw response: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.write(postData);
            req.end();
        });
    }

    async testFlow() {
        console.log('🧪 Testing N8N MCP Server Complete Flow');
        console.log('=======================================');
        
        try {
            // Step 1: Initialize
            console.log('\n1️⃣ Testing initialize...');
            const initResult = await this.sendRequest('initialize', {
                protocolVersion: "2024-11-05",
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {}
                },
                clientInfo: {
                    name: "n8n-mcp-test-client",
                    version: "1.0.0"
                }
            });
            console.log('✅ Initialize result:', JSON.stringify(initResult, null, 2));

            // Step 2: Send initialized notification
            console.log('\n2️⃣ Testing notifications/initialized...');
            const notifyResult = await this.sendRequest('notifications/initialized');
            console.log('✅ Notification result:', JSON.stringify(notifyResult, null, 2));

            // Step 3: List tools
            console.log('\n3️⃣ Testing tools/list...');
            const toolsResult = await this.sendRequest('tools/list');
            console.log('✅ Tools list result:', JSON.stringify(toolsResult, null, 2));
            
            if (toolsResult && toolsResult.tools) {
                console.log(`📋 Found ${toolsResult.tools.length} tools:`);
                toolsResult.tools.forEach((tool, index) => {
                    console.log(`   ${index + 1}. ${tool.name}: ${tool.description}`);
                });
            }

            // Step 4: Test a tool call (get_workflows)
            if (toolsResult && toolsResult.tools && toolsResult.tools.length > 0) {
                console.log('\n4️⃣ Testing tools/call (get_workflows)...');
                const toolCallResult = await this.sendRequest('tools/call', {
                    name: 'get_workflows',
                    arguments: {}
                });
                console.log('✅ Tool call result:', JSON.stringify(toolCallResult, null, 2));
            }

            console.log('\n🎉 All tests completed successfully!');
            console.log('\n📝 Summary:');
            console.log('- MCP server is responding correctly');
            console.log('- Protocol handshake works');
            console.log('- Tools are being listed properly');
            console.log('- Tool calls are working (may fail due to N8N auth, but that\'s expected)');
            
        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            process.exit(1);
        }
    }
}

// Run the test
async function main() {
    if (API_TOKEN === 'your-api-token-here') {
        console.log('⚠️  Please set the API_TOKEN environment variable');
        console.log('Usage: API_TOKEN=your_token node test-mcp-client.js');
        process.exit(1);
    }

    const client = new MCPClient(MCP_SERVER_URL, API_TOKEN);
    await client.testFlow();
}

main().catch(console.error);