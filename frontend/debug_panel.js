// Debug Panel Vue Component
const DebugPanel = {
    data() {
        return {
            logs: [],
            isConnected: false,
            isPaused: false,
            maxLogs: 1000,
            filterLevel: 'info',
            autoScroll: true
        };
    },
    template: `
        <div class="debug-panel-vue">
            <div class="debug-panel-controls">
                <div class="debug-controls-row">
                    <button 
                        class="debug-control-btn" 
                        :class="{ active: !isPaused }"
                        @click="togglePause">
                        {{ isPaused ? '▶️ 继续' : '⏸️ 暂停' }}
                    </button>
                    <button 
                        class="debug-control-btn clear" 
                        @click="clearLogs">
                        🗑️ 清空
                    </button>
                    <button 
                        class="debug-control-btn" 
                        :class="{ active: autoScroll }"
                        @click="toggleAutoScroll">
                        {{ autoScroll ? '📜 自动滚动' : '📜 手动滚动' }}
                    </button>
                </div>
                <div class="debug-controls-row">
                    <select v-model="filterLevel" class="debug-filter-select">
                        <option value="all">所有级别</option>
                        <option value="error">错误</option>
                        <option value="warn">警告</option>
                        <option value="info">信息</option>
                        <option value="debug">调试</option>
                    </select>
                    <span class="debug-status">
                        状态: {{ isConnected ? '已连接' : '未连接' }}
                        <span class="debug-status-indicator" :class="{ active: isConnected, inactive: !isConnected }"></span>
                    </span>
                </div>
            </div>
            <div class="debug-panel-content" ref="logContainer" @scroll="handleScroll">
                <div 
                    v-for="log in filteredLogs" 
                    :key="log.id"
                    class="debug-log-entry"
                    :class="log.level">
                    <div class="debug-log-timestamp">{{ formatTimestamp(log.timestamp) }}</div>
                    <div class="debug-log-message">{{ log.message }}</div>
                    <div v-if="log.meta && Object.keys(log.meta).length > 0" class="debug-log-meta">
                        {{ formatMeta(log.meta) }}
                    </div>
                </div>
                <div v-if="filteredLogs.length === 0" class="debug-log-entry info">
                    <div class="debug-log-message">暂无日志消息...</div>
                </div>
            </div>
        </div>
    `,
    computed: {
        filteredLogs() {
            const levelHierarchy = {
                'debug': ['error', 'warn', 'info', 'debug'],
                'info': ['error', 'warn', 'info'],
                'warn': ['error', 'warn'],
                'error': ['error'],
                'all': ['error', 'warn', 'info', 'debug']
            };
            
            const allowedLevels = levelHierarchy[this.filterLevel] || ['error', 'warn', 'info', 'debug'];
            return this.logs.filter(log => allowedLevels.includes(log.level));
        }
    },
    methods: {
        addLog(logData) {
            if (this.isPaused) return;
            
            const log = {
                id: Date.now() + Math.random(),
                timestamp: logData.timestamp || new Date().toISOString(),
                level: logData.level || 'info',
                message: logData.message || '',
                meta: logData.meta || {}
            };
            
            this.logs.push(log);
            
            // 限制日志数量
            if (this.logs.length > this.maxLogs) {
                this.logs.splice(0, this.logs.length - this.maxLogs);
            }
            
            // 自动滚动到底部
            if (this.autoScroll) {
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            }
        },
        
        togglePause() {
            this.isPaused = !this.isPaused;
        },
        
        clearLogs() {
            this.logs = [];
        },
        
        toggleAutoScroll() {
            this.autoScroll = !this.autoScroll;
            if (this.autoScroll) {
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            }
        },
        
        handleScroll() {
            // 简化滚动处理，不阻止滚动功能
            // 这个方法保留以防未来需要滚动事件处理
        },
        
        scrollToBottom() {
            if (this.$refs.logContainer) {
                this.$refs.logContainer.scrollTop = this.$refs.logContainer.scrollHeight;
            }
        },
        
        formatTimestamp(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('zh-CN', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
            });
        },
        
        formatMeta(meta) {
            try {
                return JSON.stringify(meta, null, 2);
            } catch (e) {
                return String(meta);
            }
        },
        
        connectToLogger() {
            // 连接到后台logger
            if (typeof ipcRenderer !== 'undefined') {
                this.isConnected = true;
                
                // 监听日志消息
                ipcRenderer.on('debug-log', (event, logData) => {
                    this.addLog(logData);
                });
                
                // 监听日志历史响应
                ipcRenderer.on('debug-logs-history', (event, logHistory) => {
                    if (Array.isArray(logHistory)) {
                        logHistory.forEach(log => this.addLog(log));
                    }
                });
                
                // 请求已有的日志
                ipcRenderer.send('request-debug-logs');
            }
        },
        
        disconnectFromLogger() {
            if (typeof ipcRenderer !== 'undefined') {
                ipcRenderer.removeAllListeners('debug-log');
                ipcRenderer.removeAllListeners('debug-logs-history');
                this.isConnected = false;
            }
        }
    },
    
    mounted() {
        this.connectToLogger();
    },
    
    beforeUnmount() {
        this.disconnectFromLogger();
    }
};

// 全局调试面板管理
let debugPanelApp = null;
let debugPanelInstance = null;

function toggleDebugPanel() {
    const panel = document.getElementById('debugPanel');
    const button = document.getElementById('debugToggleButton');
    const chatContainer = document.querySelector('.chat-container');
    
    if (panel.classList.contains('open')) {
        // 关闭面板
        panel.classList.remove('open');
        button.classList.remove('panel-open');
        chatContainer.classList.remove('debug-panel-open');
        
        // 断开Vue应用连接
        if (debugPanelInstance) {
            debugPanelInstance.disconnectFromLogger();
        }
    } else {
        // 打开面板
        panel.classList.add('open');
        button.classList.add('panel-open');
        chatContainer.classList.add('debug-panel-open');
        
        // 创建Vue应用（如果还没有创建）
        if (!debugPanelApp) {
            const { createApp } = Vue;
            debugPanelApp = createApp(DebugPanel);
            debugPanelInstance = debugPanelApp.mount('#debugPanelContent');
        } else if (debugPanelInstance) {
            debugPanelInstance.connectToLogger();
        }
    }
}

function closeDebugPanel() {
    const panel = document.getElementById('debugPanel');
    const button = document.getElementById('debugToggleButton');
    const chatContainer = document.querySelector('.chat-container');
    
    panel.classList.remove('open');
    button.classList.remove('panel-open');
    chatContainer.classList.remove('debug-panel-open');
    
    if (debugPanelInstance) {
        debugPanelInstance.disconnectFromLogger();
    }
}

// 监听ESC键关闭面板
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const panel = document.getElementById('debugPanel');
        if (panel && panel.classList.contains('open')) {
            closeDebugPanel();
        }
    }
});

// 暴露到全局作用域
window.toggleDebugPanel = toggleDebugPanel;
window.closeDebugPanel = closeDebugPanel;