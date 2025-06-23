import express from 'express';
import { config } from '../config/index.js';

const router = express.Router();

const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>N8N MCP Server - OAuth Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gray-50 min-h-screen">
    <div x-data="dashboard()" x-init="init()" class="container mx-auto py-8 px-4">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-sm mb-6 p-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">N8N MCP Server</h1>
                        <p class="text-gray-600">OAuth Access Management</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4" x-show="user">
                    <img :src="user?.avatar" :alt="user?.name" class="w-8 h-8 rounded-full">
                    <div class="text-right">
                        <p class="text-sm font-medium text-gray-900" x-text="user?.name"></p>
                        <p class="text-xs text-gray-500" x-text="user?.email"></p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Auth Status / Login Form -->
        <div class="bg-white rounded-lg shadow-sm mb-6 p-6" x-show="!user">
            <div class="text-center" x-show="!showLoginForm">
                <h2 class="text-xl font-semibold text-gray-900 mb-4">Authentication Required</h2>
                <p class="text-gray-600 mb-6">Please authenticate to manage your MCP access tokens.</p>
                <div class="space-y-3">
                    <button @click="showLoginForm = true" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-3">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        Login with Email
                    </button>
                    <a href="/auth/login/oauth" class="inline-flex items-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900">
                        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"></path>
                        </svg>
                        Login with GitHub
                    </a>
                </div>
            </div>
            
            <!-- Custom Login Form -->
            <div x-show="showLoginForm">
                <div class="max-w-md mx-auto">
                    <h2 class="text-xl font-semibold text-gray-900 mb-4 text-center">Login</h2>
                    <form @submit.prevent="customLogin()">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <input x-model="loginForm.email" type="email" required 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <input x-model="loginForm.password" type="password" required 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="flex space-x-3">
                            <button type="submit" :disabled="loginLoading" 
                                    class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
                                <span x-show="!loginLoading">Login</span>
                                <span x-show="loginLoading">Logging in...</span>
                            </button>
                            <button type="button" @click="showLoginForm = false" 
                                    class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </form>
                    <div x-show="loginError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p class="text-sm text-red-600" x-text="loginError"></p>
                    </div>
                </div>
            </div>
        </div>

        <!-- API Information -->
        <div class="bg-white rounded-lg shadow-sm mb-6 p-6" x-show="user">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">API Endpoints</h2>
            <div class="grid md:grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="font-medium text-gray-900 mb-2">MCP JSON-RPC Endpoint</h3>
                    <code class="text-sm text-blue-600 break-all">https://n8n-mcp.${config.domain}/mcp</code>
                    <p class="text-xs text-gray-500 mt-1">POST requests for MCP JSON-RPC calls</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="font-medium text-gray-900 mb-2">Health Check</h3>
                    <code class="text-sm text-blue-600 break-all">https://n8n-mcp.${config.domain}/health</code>
                    <p class="text-xs text-gray-500 mt-1">GET request to check server status</p>
                </div>
            </div>
        </div>

        <!-- Token Management -->
        <div class="bg-white rounded-lg shadow-sm mb-6 p-6" x-show="user">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-semibold text-gray-900">Access Tokens</h2>
                <button @click="createToken()" class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Create Token
                </button>
            </div>
            
            <div x-show="tokens.length === 0" class="text-center py-8 text-gray-500">
                <p>No access tokens created yet.</p>
                <p class="text-sm">Create a token to access the MCP API.</p>
            </div>

            <div class="space-y-4" x-show="tokens.length > 0">
                <template x-for="token in tokens" :key="token.token">
                    <div class="border rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-2">
                                    <code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono" x-text="token.token.substring(0, 12) + '...'"></code>
                                    <button @click="copyToken(token.fullToken)" class="text-blue-600 hover:text-blue-800 text-sm">
                                        Copy Full Token
                                    </button>
                                </div>
                                <div class="text-sm text-gray-600">
                                    <p>Scopes: <span x-text="token.scopes.join(', ')"></span></p>
                                    <p>Created: <span x-text="new Date(token.createdAt).toLocaleString()"></span></p>
                                    <p>Expires: <span x-text="new Date(token.expiresAt).toLocaleString()"></span></p>
                                </div>
                            </div>
                            <button @click="revokeToken(token.fullToken)" class="text-red-600 hover:text-red-800 text-sm font-medium">
                                Revoke
                            </button>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- Usage Instructions -->
        <div class="bg-white rounded-lg shadow-sm p-6" x-show="user">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Usage Instructions</h2>
            <div class="space-y-4 text-sm">
                <div>
                    <h3 class="font-medium text-gray-900 mb-2">1. Authentication</h3>
                    <p class="text-gray-600 mb-2">Include your access token in requests using one of these methods:</p>
                    <div class="bg-gray-50 rounded p-3 font-mono text-xs">
                        <p class="mb-1">Authorization: Bearer YOUR_ACCESS_TOKEN</p>
                        <p>X-API-Key: YOUR_ACCESS_TOKEN</p>
                    </div>
                </div>
                
                <div>
                    <h3 class="font-medium text-gray-900 mb-2">2. MCP JSON-RPC Calls</h3>
                    <p class="text-gray-600 mb-2">Send POST requests to the MCP endpoint:</p>
                    <div class="bg-gray-50 rounded p-3 font-mono text-xs">
curl -X POST https://n8n-mcp.${config.domain}/mcp \\<br>
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\<br>
  -H "Content-Type: application/json" \\<br>
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
                    </div>
                </div>

                <div>
                    <h3 class="font-medium text-gray-900 mb-2">3. Claude.ai Integration</h3>
                    <p class="text-gray-600 mb-2">Use these endpoints in Claude.ai custom integrations:</p>
                    <div class="bg-gray-50 rounded p-3 font-mono text-xs">
                        <p class="mb-1">URL: https://n8n-mcp.${config.domain}/mcp</p>
                        <p class="mb-1">Method: POST</p>
                        <p>Headers: Authorization: Bearer YOUR_ACCESS_TOKEN</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function dashboard() {
            return {
                user: null,
                tokens: [],
                jwt: null,
                showLoginForm: false,
                loginForm: {
                    email: '',
                    password: ''
                },
                loginLoading: false,
                loginError: '',
                
                init() {
                    const urlParams = new URLSearchParams(window.location.search);
                    const token = urlParams.get('token');
                    const userStr = urlParams.get('user');
                    
                    if (token && userStr) {
                        this.jwt = token;
                        this.user = JSON.parse(decodeURIComponent(userStr));
                        this.loadTokens();
                        
                        // Clean URL
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                },
                
                async loadTokens() {
                    if (!this.jwt) return;
                    
                    try {
                        const response = await fetch('/auth/tokens', {
                            headers: {
                                'Authorization': \`Bearer \${this.jwt}\`
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            this.tokens = data.data;
                        }
                    } catch (error) {
                        console.error('Failed to load tokens:', error);
                    }
                },
                
                async createToken() {
                    if (!this.jwt) return;
                    
                    try {
                        const response = await fetch('/auth/token', {
                            method: 'POST',
                            headers: {
                                'Authorization': \`Bearer \${this.jwt}\`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                scopes: ['mcp:read', 'mcp:write']
                            })
                        });
                        
                        if (response.ok) {
                            await this.loadTokens();
                            alert('Token created successfully!');
                        } else {
                            alert('Failed to create token');
                        }
                    } catch (error) {
                        console.error('Failed to create token:', error);
                        alert('Failed to create token');
                    }
                },
                
                async revokeToken(token) {
                    if (!this.jwt || !confirm('Are you sure you want to revoke this token?')) return;
                    
                    try {
                        const response = await fetch(\`/auth/token/\${token}\`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': \`Bearer \${this.jwt}\`
                            }
                        });
                        
                        if (response.ok) {
                            await this.loadTokens();
                            alert('Token revoked successfully!');
                        } else {
                            alert('Failed to revoke token');
                        }
                    } catch (error) {
                        console.error('Failed to revoke token:', error);
                        alert('Failed to revoke token');
                    }
                },
                
                async copyToken(token) {
                    try {
                        await navigator.clipboard.writeText(token);
                        alert('Token copied to clipboard!');
                    } catch (error) {
                        console.error('Failed to copy token:', error);
                        alert('Failed to copy token to clipboard');
                    }
                },
                
                async customLogin() {
                    this.loginLoading = true;
                    this.loginError = '';
                    
                    try {
                        const response = await fetch('/auth/login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                email: this.loginForm.email,
                                password: this.loginForm.password
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok && data.success) {
                            this.jwt = data.data.token;
                            this.user = data.data.user;
                            this.showLoginForm = false;
                            this.loginForm.email = '';
                            this.loginForm.password = '';
                            await this.loadTokens();
                        } else {
                            this.loginError = data.error || 'Login failed';
                        }
                    } catch (error) {
                        this.loginError = 'Network error: ' + error.message;
                    } finally {
                        this.loginLoading = false;
                    }
                }
            }
        }
    </script>
</body>
</html>
`;

router.get('/', (req, res) => {
  res.send(dashboardHTML);
});

export default router;