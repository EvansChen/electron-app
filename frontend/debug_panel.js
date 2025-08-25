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
                        {{ autoScroll ? '📜 自动' : '📜 手动' }}
                    </button>
                    <button 
                        class="debug-control-btn devtools" 
                        @click="openDevTools">
                        🔧 DvT
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
                    :class="log.level"
                    @contextmenu="showContextMenu($event, log)">
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
        
        openDevTools() {
            // 调用 Electron 的 ipcRenderer 打开开发者工具
            if (typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('open-devtools');
            } else {
                console.error('Electron ipcRenderer 不可用');
            }
        },
        
        scrollToBottom() {
            if (this.$refs.logContainer) {
                this.$refs.logContainer.scrollTop = this.$refs.logContainer.scrollHeight;
            }
        },
        
        showContextMenu(event, log) {
            event.preventDefault();
            
            // 创建右键菜单
            const contextMenu = document.createElement('div');
            contextMenu.className = 'debug-context-menu';
            contextMenu.innerHTML = `
                <div class="debug-context-menu-item" data-action="copy-message">复制消息</div>
                <div class="debug-context-menu-item" data-action="copy-full">复制完整日志</div>
                <div class="debug-context-menu-item" data-action="copy-timestamp">复制时间戳</div>
            `;
            
            // 设置菜单位置
            contextMenu.style.position = 'fixed';
            contextMenu.style.left = event.clientX + 'px';
            contextMenu.style.top = event.clientY + 'px';
            contextMenu.style.zIndex = '10000';
            
            // 添加到页面
            document.body.appendChild(contextMenu);
            
            // 添加点击事件
            contextMenu.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action) {
                    this.handleContextMenuAction(action, log);
                }
                this.removeContextMenu();
            });
            
            // 点击其他地方关闭菜单
            const closeMenu = (e) => {
                if (!contextMenu.contains(e.target)) {
                    this.removeContextMenu();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        },
        
        handleContextMenuAction(action, log) {
            let textToCopy = '';
            
            switch (action) {
                case 'copy-message':
                    textToCopy = log.message;
                    break;
                case 'copy-full':
                    textToCopy = `[${this.formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`;
                    if (log.meta && Object.keys(log.meta).length > 0) {
                        textToCopy += `\n${this.formatMeta(log.meta)}`;
                    }
                    break;
                case 'copy-timestamp':
                    textToCopy = this.formatTimestamp(log.timestamp);
                    break;
            }
            
            this.copyToClipboard(textToCopy);
        },
        
        copyToClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                // 使用现代 clipboard API
                navigator.clipboard.writeText(text).then(() => {
                    this.showCopyNotification('已复制到剪贴板');
                }).catch(err => {
                    console.error('复制失败:', err);
                    this.fallbackCopyToClipboard(text);
                });
            } else {
                // 回退方案
                this.fallbackCopyToClipboard(text);
            }
        },
        
        fallbackCopyToClipboard(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.showCopyNotification('已复制到剪贴板');
            } catch (err) {
                console.error('复制失败:', err);
                this.showCopyNotification('复制失败');
            }
            
            document.body.removeChild(textArea);
        },
        
        showCopyNotification(message) {
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = 'debug-copy-notification';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                z-index: 10001;
                font-size: 12px;
                transition: opacity 0.3s;
            `;
            
            document.body.appendChild(notification);
            
            // 3秒后移除
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 2000);
        },
        
        removeContextMenu() {
            const existingMenu = document.querySelector('.debug-context-menu');
            if (existingMenu) {
                document.body.removeChild(existingMenu);
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
        this.removeContextMenu();
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