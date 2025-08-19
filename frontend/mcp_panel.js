// MCP Panel Vue Component
const { createApp, ref, reactive, computed, onMounted } = Vue;

// Electron API wrapper for Vue component
const electronAPI = {
    getMcpConfig: () => {
        return new Promise((resolve, reject) => {
            const { ipcRenderer } = require('electron');
            
            // 清除可能存在的旧监听器
            ipcRenderer.removeAllListeners('current-mcp-config-response');
            
            const timeout = setTimeout(() => {
                ipcRenderer.removeAllListeners('current-mcp-config-response');
                reject(new Error('获取配置超时'));
            }, 5000);
            
            ipcRenderer.once('current-mcp-config-response', (event, response) => {
                clearTimeout(timeout);
                if (response.success) {
                    resolve(response.config);
                } else {
                    reject(new Error(response.error));
                }
            });
            ipcRenderer.send('get-current-mcp-config');
        });
    },
    
    saveMcpConfig: (config) => {
        return new Promise((resolve, reject) => {
            const { ipcRenderer } = require('electron');
            ipcRenderer.once('update-mcp-config-response', (event, response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
            ipcRenderer.send('update-mcp-config', config);
        });
    },
    
    connectMcpServer: (server) => {
        return new Promise((resolve, reject) => {
            const { ipcRenderer } = require('electron');
            
            // 清除可能存在的旧监听器
            ipcRenderer.removeAllListeners('connect-mcp-server-response');
            
            const timeout = setTimeout(() => {
                ipcRenderer.removeAllListeners('connect-mcp-server-response');
                reject(new Error('连接超时'));
            }, 10000);
            
            ipcRenderer.once('connect-mcp-server-response', (event, response) => {
                clearTimeout(timeout);
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
            
            // 清理服务器对象，只发送必要的配置数据
            const cleanServer = {
                id: server.id,
                name: server.name,
                description: server.description,
                type: server.type,
                baseUrl: server.baseUrl,
                isActive: server.isActive,
                headers: server.headers ? { ...server.headers } : {}
            };
            
            ipcRenderer.send('connect-mcp-server', cleanServer);
        });
    },
    
    disconnectMcpServer: (serverId) => {
        return new Promise((resolve, reject) => {
            const { ipcRenderer } = require('electron');
            ipcRenderer.once('disconnect-mcp-server-response', (event, response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
            ipcRenderer.send('disconnect-mcp-server', serverId);
        });
    },
    
    testMcpTool: (options) => {
        return new Promise((resolve, reject) => {
            const { ipcRenderer } = require('electron');
            ipcRenderer.once('test-mcp-tool-response', (event, response) => {
                if (response.success !== undefined) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Unknown error'));
                }
            });
            ipcRenderer.send('test-mcp-tool', options);
        });
    }
};

// 如果在浏览器环境中，提供模拟API
if (typeof window !== 'undefined' && !window.electronAPI) {
    window.electronAPI = electronAPI;
}

// MCP Panel 组件
const MCPPanel = {
    setup() {
        // 响应式数据
        const mcpServers = ref([]);
        const selectedServer = ref(null);
        const isLoading = ref(false);
        const testResults = ref([]);
        const showAddForm = ref(false);
        
        // 新服务器表单数据
        const newServer = reactive({
            id: '',
            name: '',
            description: '',
            type: 'sse',
            baseUrl: '',
            isActive: true,
            headers: {
                Authorization: ''
            }
        });

        // 测试表单数据
        const testForm = reactive({
            toolName: '',
            parameters: '{}'
        });

        // 计算属性
        const activeServers = computed(() => {
            return mcpServers.value.filter(server => server.isActive);
        });

        const availableTools = computed(() => {
            return selectedServer.value?.tools || [];
        });

        // 方法
        const isLoadingConfig = ref(false);
        
        const loadMcpConfig = async () => {
            if (isLoadingConfig.value) {
                console.log('配置正在加载中，跳过重复请求');
                return;
            }
            
            try {
                isLoadingConfig.value = true;
                isLoading.value = true;
                console.log('开始加载MCP配置');
                
                // 调用主进程的API加载配置
                const config = await window.electronAPI.getMcpConfig();
                if (config && config.mcpServers) {
                    mcpServers.value = Object.entries(config.mcpServers).map(([id, serverConfig]) => ({
                        id,
                        ...serverConfig
                    }));
                    console.log('MCP配置加载成功，服务器数量:', mcpServers.value.length);
                } else {
                    console.log('未找到MCP服务器配置');
                    mcpServers.value = [];
                }
            } catch (error) {
                console.error('加载MCP配置失败:', error);
                showNotification('加载配置失败: ' + error.message, 'error');
                mcpServers.value = [];
            } finally {
                isLoadingConfig.value = false;
                isLoading.value = false;
            }
        };

        const saveMcpConfig = async () => {
            try {
                isLoading.value = true;
                const config = {
                    mcpServers: {}
                };
                
                mcpServers.value.forEach(server => {
                    const { id, ...serverConfig } = server;
                    config.mcpServers[id] = serverConfig;
                });

                await window.electronAPI.saveMcpConfig(config);
                showNotification('配置保存成功', 'success');
            } catch (error) {
                console.error('保存MCP配置失败:', error);
                showNotification('保存配置失败: ' + error.message, 'error');
            } finally {
                isLoading.value = false;
            }
        };

        const addServer = () => {
            if (!newServer.id || !newServer.name || !newServer.baseUrl) {
                showNotification('请填写必填字段', 'warning');
                return;
            }

            if (mcpServers.value.find(s => s.id === newServer.id)) {
                showNotification('服务器ID已存在', 'warning');
                return;
            }

            mcpServers.value.push({
                id: newServer.id,
                name: newServer.name,
                description: newServer.description,
                type: newServer.type,
                baseUrl: newServer.baseUrl,
                isActive: newServer.isActive,
                headers: { ...newServer.headers }
            });

            // 重置表单
            Object.assign(newServer, {
                id: '',
                name: '',
                description: '',
                type: 'sse',
                baseUrl: '',
                isActive: true,
                headers: { Authorization: '' }
            });

            showAddForm.value = false;
            showNotification('服务器添加成功', 'success');
        };

        const removeServer = (index) => {
            if (confirm('确定要删除这个服务器吗？')) {
                mcpServers.value.splice(index, 1);
                if (selectedServer.value && selectedServer.value.id === mcpServers.value[index]?.id) {
                    selectedServer.value = null;
                }
                showNotification('服务器删除成功', 'success');
            }
        };

        const selectServer = (server) => {
            selectedServer.value = server;
        };

        const connectServer = async (server) => {
            if (!server || !server.baseUrl) {
                console.warn('无效的服务器配置:', server);
                showNotification('无效的服务器配置', 'error');
                return;
            }
            
            console.log('尝试连接服务器:', {
                name: server.name || server.id,
                id: server.id,
                baseUrl: server.baseUrl,
                type: server.type
            });
            
            try {
                isLoading.value = true;
                server.connecting = true; // 添加连接中状态
                
                const result = await window.electronAPI.connectMcpServer(server);
                console.log('连接结果:', result);
                
                if (result.success) {
                    server.tools = result.tools || [];
                    server.connected = true;
                    server.lastConnected = new Date().toISOString();
                    console.log(`连接成功，获取到 ${server.tools.length} 个工具`);
                    showNotification(`连接到 ${server.name} 成功，发现 ${server.tools.length} 个工具`, 'success');
                } else {
                    throw new Error(result.error || '连接失败');
                }
            } catch (error) {
                console.error('连接服务器失败:', {
                    serverName: server.name || server.id,
                    baseUrl: server.baseUrl,
                    serverType: server.type,
                    error: error.message,
                    stack: error.stack
                });
                
                server.connected = false;
                server.tools = []; // 清空工具列表
                server.lastError = error.message;
                
                // 提供更友好的错误提示
                let userMessage = '连接失败: ' + error.message;
                if (error.message.includes('401') || error.message.includes('身份验证')) {
                    userMessage += '\n建议检查API密钥是否正确或是否已过期';
                } else if (error.message.includes('403') || error.message.includes('权限')) {
                    userMessage += '\n请检查API密钥的权限设置';
                } else if (error.message.includes('404') || error.message.includes('不存在')) {
                    userMessage += '\n请检查服务器URL路径是否正确';
                } else if (error.message.includes('超时')) {
                    userMessage += '\n建议检查网络连接和服务器状态';
                } else if (error.message.includes('解析')) {
                    userMessage += '\n请检查服务器URL格式是否正确';
                } else if (error.message.includes('拒绝')) {
                    userMessage += '\n请确认服务器已启动并可访问';
                }
                
                showNotification(userMessage, 'error');
            } finally {
                isLoading.value = false;
                server.connecting = false;
            }
        };

        const disconnectServer = async (server) => {
            try {
                await window.electronAPI.disconnectMcpServer(server.id);
                server.connected = false;
                server.tools = [];
                showNotification(`从 ${server.name} 断开连接`, 'info');
            } catch (error) {
                console.error('断开连接失败:', error);
                showNotification('断开连接失败: ' + error.message, 'error');
            }
        };

        const testTool = async () => {
            if (!selectedServer.value || !testForm.toolName) {
                showNotification('请选择服务器和工具', 'warning');
                return;
            }

            try {
                isLoading.value = true;
                let parameters = {};
                
                if (testForm.parameters.trim()) {
                    parameters = JSON.parse(testForm.parameters);
                }

                const result = await window.electronAPI.testMcpTool({
                    serverId: selectedServer.value.id,
                    toolName: testForm.toolName,
                    parameters
                });

                testResults.value.unshift({
                    timestamp: new Date().toLocaleString(),
                    server: selectedServer.value.name,
                    tool: testForm.toolName,
                    parameters,
                    result: result.success ? result.data : result.error,
                    success: result.success
                });

                showNotification('工具测试完成', result.success ? 'success' : 'error');
            } catch (error) {
                console.error('测试工具失败:', error);
                showNotification('测试失败: ' + error.message, 'error');
                
                testResults.value.unshift({
                    timestamp: new Date().toLocaleString(),
                    server: selectedServer.value.name,
                    tool: testForm.toolName,
                    parameters: testForm.parameters,
                    result: error.message,
                    success: false
                });
            } finally {
                isLoading.value = false;
            }
        };

        const clearTestResults = () => {
            testResults.value = [];
        };

        const showNotification = (message, type = 'info') => {
            // 简单的通知实现
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        };

        // 生命周期
        onMounted(() => {
            loadMcpConfig();
        });

        return {
            // 数据
            mcpServers,
            selectedServer,
            isLoading,
            testResults,
            showAddForm,
            newServer,
            testForm,
            
            // 计算属性
            activeServers,
            availableTools,
            
            // 方法
            loadMcpConfig,
            saveMcpConfig,
            addServer,
            removeServer,
            selectServer,
            connectServer,
            disconnectServer,
            testTool,
            clearTestResults
        };
    },
    
    template: `
        <div class="mcp-panel">
            <div class="panel-header">
                <h2>MCP 服务器管理</h2>
                <div class="header-actions">
                    <button @click="loadMcpConfig" :disabled="isLoading" class="btn btn-secondary">
                        {{ isLoading ? '加载中...' : '刷新配置' }}
                    </button>
                    <button @click="saveMcpConfig" :disabled="isLoading" class="btn btn-primary">
                        保存配置
                    </button>
                    <button @click="showAddForm = true" class="btn btn-success">
                        添加服务器
                    </button>
                </div>
            </div>

            <!-- 服务器列表 -->
            <div class="servers-section">
                <h3>服务器列表 ({{ mcpServers.length }})</h3>
                <div class="servers-grid">
                    <div 
                        v-for="(server, index) in mcpServers" 
                        :key="server.id"
                        :class="['server-card', { active: selectedServer?.id === server.id, connected: server.connected }]"
                        @click="selectServer(server)"
                    >
                        <div class="server-header">
                            <h4>{{ server.name }}</h4>
                            <div class="server-actions">
                                <button 
                                    v-if="!server.connected"
                                    @click.stop="connectServer(server)"
                                    :disabled="isLoading"
                                    class="btn btn-sm btn-primary"
                                >
                                    连接
                                </button>
                                <button 
                                    v-else
                                    @click.stop="disconnectServer(server)"
                                    class="btn btn-sm btn-warning"
                                >
                                    断开
                                </button>
                                <button 
                                    @click.stop="removeServer(index)"
                                    class="btn btn-sm btn-danger"
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                        <div class="server-info">
                            <p><strong>ID:</strong> {{ server.id }}</p>
                            <p><strong>类型:</strong> {{ server.type }}</p>
                            <p><strong>URL:</strong> {{ server.baseUrl }}</p>
                            <p><strong>状态:</strong> 
                                <span :class="['status', server.isActive ? 'active' : 'inactive']">
                                    {{ server.isActive ? '激活' : '禁用' }}
                                </span>
                                <span v-if="server.connected" class="status connected">已连接</span>
                            </p>
                            <p v-if="server.description"><strong>描述:</strong> {{ server.description }}</p>
                            <p v-if="server.tools"><strong>工具数量:</strong> {{ server.tools.length }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 工具测试区域 -->
            <div v-if="selectedServer" class="testing-section">
                <h3>工具测试 - {{ selectedServer.name }}</h3>
                <div class="test-form">
                    <div class="form-group">
                        <label>选择工具:</label>
                        <select v-model="testForm.toolName" class="form-control">
                            <option value="">请选择工具</option>
                            <option v-for="tool in availableTools" :key="tool.name" :value="tool.name">
                                {{ tool.name }} - {{ tool.description || '无描述' }}
                            </option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>参数 (JSON):</label>
                        <textarea 
                            v-model="testForm.parameters" 
                            class="form-control"
                            rows="4"
                            placeholder='{"param1": "value1", "param2": "value2"}'
                        ></textarea>
                    </div>
                    <div class="form-actions">
                        <button @click="testTool" :disabled="isLoading || !testForm.toolName" class="btn btn-primary">
                            {{ isLoading ? '测试中...' : '测试工具' }}
                        </button>
                        <button @click="clearTestResults" class="btn btn-secondary">
                            清空结果
                        </button>
                    </div>
                </div>

                <!-- 测试结果 -->
                <div v-if="testResults.length > 0" class="test-results">
                    <h4>测试结果</h4>
                    <div v-for="result in testResults" :key="result.timestamp" :class="['result-item', { success: result.success, error: !result.success }]">
                        <div class="result-header">
                            <span class="timestamp">{{ result.timestamp }}</span>
                            <span class="server-tool">{{ result.server }} - {{ result.tool }}</span>
                            <span :class="['status', result.success ? 'success' : 'error']">
                                {{ result.success ? '成功' : '失败' }}
                            </span>
                        </div>
                        <div class="result-content">
                            <details>
                                <summary>查看详情</summary>
                                <div class="result-details">
                                    <h5>参数:</h5>
                                    <pre>{{ JSON.stringify(result.parameters, null, 2) }}</pre>
                                    <h5>结果:</h5>
                                    <pre>{{ typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2) }}</pre>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 添加服务器模态框 -->
            <div v-if="showAddForm" class="modal-overlay" @click="showAddForm = false">
                <div class="modal" @click.stop>
                    <div class="modal-header">
                        <h3>添加新服务器</h3>
                        <button @click="showAddForm = false" class="btn btn-close">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>服务器ID *:</label>
                            <input v-model="newServer.id" type="text" class="form-control" placeholder="WebSearch">
                        </div>
                        <div class="form-group">
                            <label>服务器名称 *:</label>
                            <input v-model="newServer.name" type="text" class="form-control" placeholder="阿里云百炼_联网搜索">
                        </div>
                        <div class="form-group">
                            <label>描述:</label>
                            <textarea v-model="newServer.description" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>类型:</label>
                            <select v-model="newServer.type" class="form-control">
                                <option value="sse">SSE</option>
                                <option value="stdio">STDIO</option>
                                <option value="http">HTTP</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>基础URL *:</label>
                            <input v-model="newServer.baseUrl" type="url" class="form-control" placeholder="https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/sse">
                        </div>
                        <div class="form-group">
                            <label>Authorization Token:</label>
                            <input v-model="newServer.headers.Authorization" type="text" class="form-control" placeholder="Bearer your-token-here">
                        </div>
                        <div class="form-group">
                            <label>
                                <input v-model="newServer.isActive" type="checkbox"> 激活状态
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button @click="showAddForm = false" class="btn btn-secondary">取消</button>
                        <button @click="addServer" class="btn btn-primary">添加</button>
                    </div>
                </div>
            </div>
        </div>
    `
};

// 导出组件
window.MCPPanel = MCPPanel;
