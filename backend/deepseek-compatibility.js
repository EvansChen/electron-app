// DeepSeek API 兼容层
// 解决 OpenAI Agents SDK 与 DeepSeek API 之间的消息格式不兼容问题

function convertMessagesForDeepSeek(messages) {
    return messages.map(message => {
        if (message.role === 'assistant' && Array.isArray(message.content)) {
            // 将复杂的 content 数组转换为简单字符串
            const textContent = message.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');
            
            return {
                ...message,
                content: textContent
            };
        }
        return message;
    });
}

// 拦截并转换 DeepSeek API 请求
const originalFetch = global.fetch;

global.fetch = function(url, options) {
    // 只对 DeepSeek API 请求进行转换
    if (options?.body && url.includes('api.deepseek.com')) {
        try {
            const body = JSON.parse(options.body);
            
            // 转换消息格式以确保 DeepSeek API 兼容性
            if (body.messages) {
                body.messages = convertMessagesForDeepSeek(body.messages);
                options.body = JSON.stringify(body);
            }
        } catch (e) {
            console.warn('Failed to convert request body for DeepSeek API:', e);
        }
    }
    
    return originalFetch.call(this, url, options);
};

console.log('DeepSeek API compatibility layer loaded');
