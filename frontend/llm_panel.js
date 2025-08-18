// LLM Panel Vue Component
const LLMPanel = {
    data() {
        return {
            config: {
                baseUrl: '',
                apiKey: '',
                modelId: ''
            },
            availableModels: [],
            showPassword: false,
            loading: false,
            testResult: null,
            configPath: '加载中...',
            showModels: false,
            filteredModels: [],
            groupedModels: {},
            expandedProviders: new Set()
        };
    },
    computed: {
        filteredModelsList() {
            if (!this.config.modelId) {
                return this.availableModels;
            }
            const filter = this.config.modelId.toLowerCase();
            return this.availableModels.filter(model => 
                model.toLowerCase().includes(filter)
            );
        }
    },
    watch: {
        'config.modelId'(newValue) {
            this.filterModels();
        }
    },
    mounted() {
        this.loadCurrentConfig();
        this.requestConfigPath();
        
        // 点击外部区域关闭模型列表
        document.addEventListener('click', this.handleClickOutside);
    },
    
    beforeDestroy() {
        document.removeEventListener('click', this.handleClickOutside);
    },
    methods: {
        loadCurrentConfig() {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('get-current-config');
            
            ipcRenderer.once('current-config-response', (event, response) => {
                if (response.success && response.config) {
                    // 确保使用纯净的对象赋值，避免Vue响应式系统问题
                    this.config.baseUrl = response.config.baseURL || '';
                    this.config.apiKey = response.config.apiKey || '';
                    this.config.modelId = response.config.modelId || '';
                }
            });
        },
        
        requestConfigPath() {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('get-config-file-path');
            
            ipcRenderer.once('config-file-path-response', (event, response) => {
                if (response.success) {
                    this.configPath = response.path;
                } else {
                    this.configPath = '获取路径失败';
                }
            });
        },

        togglePasswordVisibility() {
            this.showPassword = !this.showPassword;
        },

        async fetchAvailableModels() {
            if (!this.config.baseUrl || !this.config.apiKey) {
                this.$refs.toast?.show('请先配置 Base URL 和 API Key', 'warning');
                return;
            }

            this.loading = true;
            try {
                const { ipcRenderer } = require('electron');
                // 创建一个纯净的配置对象，避免传递Vue响应式对象
                const configToSend = {
                    baseUrl: this.config.baseUrl,
                    apiKey: this.config.apiKey
                };
                ipcRenderer.send('get-available-models', configToSend);

                ipcRenderer.once('available-models-response', (event, response) => {
                    this.loading = false;
                    if (response.success) {
                        // 处理模型数据，确保是字符串数组
                        let models = response.models || [];
                        if (Array.isArray(models) && models.length > 0) {
                            // 如果返回的是对象数组，提取id字段
                            if (typeof models[0] === 'object' && models[0].id) {
                                models = models.map(model => model.id);
                            }
                        }
                        
                        this.availableModels = models;
                        // 获取模型后直接显示所有模型，不受当前输入内容影响
                        this.filteredModels = [...this.availableModels];
                        this.groupedModels = this.groupModelsByProvider(this.filteredModels);
                        this.showModels = true;
                        
                        // 所有provider默认收起
                        this.expandedProviders.clear();
                        
                        console.log('获取到的模型列表:', this.availableModels);
                        console.log('分组后的模型:', this.groupedModels);
                        console.log('showModels状态:', this.showModels);
                        this.$refs.toast?.show(`获取到 ${this.availableModels.length} 个可用模型`, 'success');
                        
                        // 确保界面更新
                        this.$nextTick(() => {
                            // 不调用filterModels，保持显示所有模型
                            console.log('Vue更新完成，filteredModels.length:', this.filteredModels.length);
                        });
                    } else {
                        this.availableModels = [];
                        this.filteredModels = [];
                        this.showModels = false;
                        this.$refs.toast?.show(`获取模型失败: ${response.error}`, 'error');
                    }
                });
            } catch (error) {
                this.loading = false;
                this.availableModels = [];
                this.filteredModels = [];
                this.showModels = false;
                this.$refs.toast?.show(`获取模型失败: ${error.message}`, 'error');
            }
        },

        groupModelsByProvider(models) {
            const grouped = {};
            
            models.forEach(model => {
                // 解析provider和model name
                let provider, modelName;
                
                if (model.includes('/')) {
                    const parts = model.split('/');
                    provider = parts[0];
                    modelName = parts.slice(1).join('/'); // 处理可能有多个斜杠的情况
                } else {
                    provider = 'Other';
                    modelName = model;
                }
                
                if (!grouped[provider]) {
                    grouped[provider] = [];
                }
                
                grouped[provider].push({
                    fullName: model,
                    displayName: modelName,
                    provider: provider
                });
            });
            
            // 按provider名称排序
            const sortedGrouped = {};
            Object.keys(grouped).sort().forEach(key => {
                // 每个provider内的模型也按名称排序
                sortedGrouped[key] = grouped[key].sort((a, b) => 
                    a.displayName.localeCompare(b.displayName)
                );
            });
            
            return sortedGrouped;
        },

        toggleProvider(provider) {
            if (this.expandedProviders.has(provider)) {
                this.expandedProviders.delete(provider);
            } else {
                this.expandedProviders.add(provider);
            }
            // 触发响应式更新
            this.expandedProviders = new Set(this.expandedProviders);
        },

        isProviderExpanded(provider) {
            return this.expandedProviders.has(provider);
        },

        selectModel(model) {
            this.config.modelId = model;
            this.showModels = false;
            this.$refs.toast?.show(`已选择模型: ${model}`, 'success', 2000);
        },

        filterModels() {
            if (!this.config.modelId || this.config.modelId.trim() === '') {
                this.filteredModels = [...this.availableModels];
            } else {
                const filter = this.config.modelId.toLowerCase();
                this.filteredModels = this.availableModels.filter(model => 
                    model.toLowerCase().includes(filter)
                );
            }
            
            // 重新分组过滤后的模型
            this.groupedModels = this.groupModelsByProvider(this.filteredModels);
            // 确保所有provider默认收起
            this.expandedProviders.clear();
            
            console.log('过滤关键词:', this.config.modelId);
            console.log('过滤后模型数量:', this.filteredModels.length);
            console.log('分组后的模型:', this.groupedModels);
        },

        showModelsIfAvailable() {
            if (this.availableModels.length > 0) {
                // 临时清空输入框内容以显示所有模型
                const originalValue = this.config.modelId;
                this.config.modelId = '';
                this.filterModels();
                this.showModels = true;
                // 确保所有provider默认收起
                this.expandedProviders.clear();
                // 恢复原始值但不触发过滤
                this.$nextTick(() => {
                    this.config.modelId = originalValue;
                });
                console.log('显示模型列表，当前可用模型数量:', this.availableModels.length);
                console.log('过滤后模型数量:', this.filteredModels.length);
            } else {
                console.log('没有可用模型，请先点击获取模型列表按钮');
            }
        },

        async testConnection() {
            if (!this.config.baseUrl || !this.config.apiKey) {
                this.$refs.toast?.show('请先填写 Base URL 和 API Key', 'warning');
                return;
            }

            this.loading = true;
            this.testResult = null;

            try {
                const { ipcRenderer } = require('electron');
                // 创建一个纯净的配置对象，避免传递Vue响应式对象
                const configToSend = {
                    baseUrl: this.config.baseUrl,
                    apiKey: this.config.apiKey,
                    modelId: this.config.modelId
                };
                ipcRenderer.send('test-model-connection', configToSend);

                ipcRenderer.once('test-connection-response', (event, response) => {
                    this.loading = false;
                    this.testResult = response;
                    
                    if (response.success) {
                        this.$refs.toast?.show('连接测试成功！', 'success');
                    } else {
                        this.$refs.toast?.show(`连接测试失败: ${response.error}`, 'error');
                    }
                });
            } catch (error) {
                this.loading = false;
                this.testResult = { success: false, error: error.message };
                this.$refs.toast?.show(`连接测试失败: ${error.message}`, 'error');
            }
        },

        async saveConfig() {
            if (!this.config.baseUrl || !this.config.apiKey || !this.config.modelId) {
                this.$refs.toast?.show('请填写所有必填字段', 'warning');
                return;
            }

            this.loading = true;
            try {
                const { ipcRenderer } = require('electron');
                // 创建一个纯净的配置对象，避免传递Vue响应式对象
                const configToSend = {
                    baseUrl: this.config.baseUrl,
                    apiKey: this.config.apiKey,
                    modelId: this.config.modelId
                };
                ipcRenderer.send('update-llm-config', configToSend);

                ipcRenderer.once('update-config-response', (event, response) => {
                    this.loading = false;
                    if (response.success) {
                        this.$refs.toast?.show('配置保存成功！', 'success');
                        // 延迟关闭面板
                        setTimeout(() => {
                            this.closeLLMPanel();
                        }, 1500);
                    } else {
                        this.$refs.toast?.show(`保存失败: ${response.error}`, 'error');
                    }
                });
            } catch (error) {
                this.loading = false;
                this.$refs.toast?.show(`保存失败: ${error.message}`, 'error');
            }
        },

        closeLLMPanel() {
            // 调用父级的关闭函数
            if (window.closeLLMPanel) {
                window.closeLLMPanel();
            }
        },
        
        showAllModels() {
            if (this.availableModels.length > 0) {
                this.filteredModels = [...this.availableModels];
                this.groupedModels = this.groupModelsByProvider(this.filteredModels);
                this.showModels = true;
                // 所有provider默认收起
                this.expandedProviders.clear();
                console.log('显示所有模型，数量:', this.filteredModels.length);
                console.log('分组数量:', Object.keys(this.groupedModels).length);
            } else {
                this.$refs.toast?.show('请先获取模型列表', 'warning');
            }
        },
        
        handleClickOutside(event) {
            // 检查点击是否在模型输入组件外部
            const modelInputGroup = event.target.closest('.model-input-group');
            const modelsList = event.target.closest('.models-list');
            
            if (!modelInputGroup && !modelsList) {
                this.showModels = false;
            }
        },

        async pasteFromClipboard(field) {
            try {
                const text = await navigator.clipboard.readText();
                if (text.trim()) {
                    this.config[field] = text.trim();
                    this.$refs.toast?.show('已粘贴剪贴板内容', 'success');
                } else {
                    this.$refs.toast?.show('剪贴板为空', 'warning');
                }
            } catch (error) {
                this.$refs.toast?.show('无法访问剪贴板', 'error');
                console.error('粘贴失败:', error);
            }
        }
    },
    template: `
        <div class="llm-panel-container">
            <Toast ref="toast" />
            
            <div class="llm-form">
                <div class="form-group">
                    <label class="form-label" for="baseUrl">Base URL <span class="required">*</span></label>
                    <div class="input-with-paste">
                        <input 
                            type="text" 
                            id="baseUrl"
                            v-model="config.baseUrl"
                            class="form-input" 
                            placeholder="例如: https://api.openai.com/v1"
                        />
                        <button 
                            type="button" 
                            class="paste-button" 
                            @click="pasteFromClipboard('baseUrl')"
                            title="从剪贴板粘贴"
                        >
                            📋
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="apiKey">API Key <span class="required">*</span></label>
                    <div class="password-field">
                        <input 
                            :type="showPassword ? 'text' : 'password'"
                            id="apiKey"
                            v-model="config.apiKey"
                            class="form-input" 
                            placeholder="输入您的 API Key"
                        />
                        <button 
                            type="button" 
                            class="paste-button" 
                            @click="pasteFromClipboard('apiKey')"
                            title="从剪贴板粘贴"
                        >
                            📋
                        </button>
                        <button 
                            type="button" 
                            class="password-toggle" 
                            @click="togglePasswordVisibility"
                            :title="showPassword ? '隐藏密码' : '显示密码'"
                        >
                            {{ showPassword ? '🙈' : '👁️' }}
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="modelId">模型 ID <span class="required">*</span></label>
                    <div class="model-input-group">
                        <input 
                            type="text" 
                            id="modelId"
                            v-model="config.modelId"
                            @input="filterModels"
                            @focus="showModelsIfAvailable"
                            class="form-input" 
                            placeholder="例如: gpt-3.5-turbo, gpt-4, 或输入关键词过滤模型"
                        />
                        <button 
                            type="button" 
                            class="btn btn-models" 
                            @click="fetchAvailableModels"
                            :disabled="loading"
                            title="获取可用模型列表"
                        >
                            {{ loading ? '⏳' : '🔄' }}
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-models" 
                            @click="showAllModels"
                            :disabled="availableModels.length === 0"
                            title="显示所有模型"
                        >
                            ...
                        </button>
                        
                        <div v-if="showModels && Object.keys(groupedModels).length > 0" class="models-list">
                            <div v-for="(models, provider) in groupedModels" :key="provider" class="provider-group">
                                <div 
                                    class="provider-header"
                                    @click="toggleProvider(provider)"
                                >
                                    <span class="provider-toggle">{{ isProviderExpanded(provider) ? '▼' : '▶' }}</span>
                                    <span class="provider-name">{{ provider }}</span>
                                    <span class="provider-count">({{ models.length }})</span>
                                </div>
                                <div v-if="isProviderExpanded(provider)" class="provider-models">
                                    <div 
                                        v-for="model in models.slice(0, 50)" 
                                        :key="model.fullName"
                                        class="model-item model-item-nested"
                                        @click="selectModel(model.fullName)"
                                    >
                                        <span class="model-name">{{ model.displayName }}</span>
                                    </div>
                                    <div v-if="models.length > 50" class="model-item-info">
                                        还有 {{ models.length - 50 }} 个{{ provider }}模型...
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 调试信息，显示模型获取状态 -->
                        <div v-if="showModels && filteredModels.length === 0 && availableModels.length === 0" class="model-item-info">
                            暂无可用模型
                        </div>
                    </div>
                </div>
                
                <div class="form-buttons">
                    <button 
                        type="button" 
                        class="btn btn-secondary" 
                        @click="closeLLMPanel"
                    >
                        取消
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-test" 
                        @click="testConnection"
                        :disabled="loading"
                    >
                        {{ loading ? '⏳ 测试中...' : '🔗 测试连接' }}
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-primary" 
                        @click="saveConfig"
                        :disabled="loading"
                    >
                        {{ loading ? '⏳ 保存中...' : '💾 保存配置' }}
                    </button>
                </div>
                
                <div class="config-note">
                    💡 提示：配置信息将安全保存在本地，用于与AI服务进行通信。请确保API Key的安全性。
                    <div class="config-path-info">
                        配置文件路径：{{ configPath }}
                    </div>
                </div>
                
                <div v-if="testResult" class="test-result" :class="{ 'success': testResult.success, 'error': !testResult.success }">
                    <strong>{{ testResult.success ? '✅ 连接成功' : '❌ 连接失败' }}</strong>
                    <div v-if="!testResult.success">{{ testResult.error }}</div>
                </div>
            </div>
        </div>
    `
};

// Toast 组件用于显示消息
const Toast = {
    data() {
        return {
            visible: false,
            message: '',
            type: 'info', // info, success, warning, error
            timer: null
        };
    },
    methods: {
        show(message, type = 'info', duration = 3000) {
            this.message = message;
            this.type = type;
            this.visible = true;
            
            if (this.timer) {
                clearTimeout(this.timer);
            }
            
            this.timer = setTimeout(() => {
                this.visible = false;
            }, duration);
        },
        
        hide() {
            this.visible = false;
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }
    },
    template: `
        <transition name="toast">
            <div v-if="visible" class="toast" :class="'toast-' + type" @click="hide">
                {{ message }}
            </div>
        </transition>
    `
};
