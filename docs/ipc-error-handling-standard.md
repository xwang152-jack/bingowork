# IPC Error Handling Standard

本文档定义了 Bingowork 项目中所有 IPC handlers 的标准错误响应格式和使用方法。

## 标准响应格式

### 成功响应

```typescript
{
  success: true;
  data?: T;  // 可选的响应数据
}
```

### 错误响应

```typescript
{
  success: false;
  error: {
    code: string;      // 标准错误代码
    message: string;   // 用户友好的错误消息
    details?: unknown; // 可选的详细信息（用于调试）
  }
}
```

## 使用方法

### 1. 导入类型和工具函数

```typescript
import {
  createSuccessResponse,
  createErrorResponse,
  IpcErrorCode,
  withIpcErrorHandling,
} from '../types/IpcResponse';
```

### 2. 直接返回响应

```typescript
// 成功响应
ipcMain.handle('channel:name', async () => {
  return createSuccessResponse({ someData: 'value' });
});

// 错误响应
ipcMain.handle('channel:name', async () => {
  return createErrorResponse(
    IpcErrorCode.NOT_FOUND,
    'Item not found',
    { itemId: '123' }
  );
});
```

### 3. 使用包装函数自动处理错误

```typescript
ipcMain.handle('channel:name', async (_event, id: string) => {
  return withIpcErrorHandling(async () => {
    const result = await someOperation(id);
    return createSuccessResponse(result);
  }, IpcErrorCode.OPERATION_FAILED)();
});
```

### 4. 检查服务是否初始化

```typescript
ipcMain.handle('channel:name', async () => {
  if (!serviceInstance) {
    return createErrorResponse(
      IpcErrorCode.NOT_INITIALIZED,
      'Service not initialized'
    );
  }

  return withIpcErrorHandling(async () => {
    return await serviceInstance!.doSomething();
  }, IpcErrorCode.OPERATION_FAILED)();
});
```

## 标准错误代码

所有错误代码定义在 `IpcErrorCode` 常量中：

```typescript
// 通用错误
UNKNOWN                    // 未知错误
INVALID_PARAMS            // 参数无效
NOT_INITIALIZED           // 未初始化
NOT_FOUND                 // 未找到
ALREADY_EXISTS            // 已存在
PERMISSION_DENIED         // 权限被拒绝
OPERATION_FAILED          // 操作失败

// 文件系统错误
FILE_NOT_FOUND           // 文件未找到
FILE_READ_ERROR          // 文件读取错误
FILE_WRITE_ERROR         // 文件写入错误
INVALID_PATH             // 路径无效

// 网络错误
NETWORK_ERROR            // 网络错误
CONNECTION_FAILED        // 连接失败
TIMEOUT                  // 超时

// 配置错误
CONFIG_INVALID           // 配置无效
CONFIG_LOAD_ERROR        // 配置加载错误
CONFIG_SAVE_ERROR        // 配置保存错误

// 会话错误
SESSION_NOT_FOUND        // 会话未找到
SESSION_LOAD_ERROR       // 会话加载错误
SESSION_SAVE_ERROR       // 会话保存错误

// 模型错误
MODEL_NOT_FOUND          // 模型未找到
MODEL_LOAD_ERROR         // 模型加载错误
API_KEY_INVALID          // API密钥无效

// MCP错误
MCP_SERVER_NOT_FOUND     // MCP服务器未找到
MCP_SERVER_ERROR         // MCP服务器错误
MCP_CONNECTION_ERROR     // MCP连接错误

// 技能错误
SKILL_NOT_FOUND          // 技能未找到
SKILL_LOAD_ERROR         // 技能加载错误
SKILL_SAVE_ERROR         // 技能保存错误

// 定时任务错误
SCHEDULE_TASK_NOT_FOUND  // 定时任务未找到
SCHEDULE_TASK_ERROR      // 定时任务错误

// Shell错误
SHELL_OPEN_FAILED        // Shell打开失败
SHELL_COMMAND_FAILED     // Shell命令失败
```

## 最佳实践

### 1. 始终使用标准格式

所有 IPC handlers 必须返回 `IpcResponse<T>` 类型：

```typescript
// ❌ 错误：直接抛出错误
ipcMain.handle('channel:name', async () => {
  throw new Error('Failed');
});

// ✅ 正确：使用标准错误响应
ipcMain.handle('channel:name', async () => {
  return withIpcErrorHandling(async () => {
    // ... 操作
  }, IpcErrorCode.OPERATION_FAILED)();
});
```

### 2. 使用适当的错误代码

选择最相关的错误代码，避免总是使用 `OPERATION_FAILED`：

```typescript
// ❌ 错误：使用通用错误代码
return createErrorResponse(
  IpcErrorCode.OPERATION_FAILED,
  'Session not found'
);

// ✅ 正确：使用具体的错误代码
return createErrorResponse(
  IpcErrorCode.SESSION_NOT_FOUND,
  'Session not found'
);
```

### 3. 提供有用的错误消息

错误消息应该对用户友好且提供足够的信息：

```typescript
// ❌ 错误：消息不够详细
return createErrorResponse(
  IpcErrorCode.FILE_NOT_FOUND,
  'Error'
);

// ✅ 正确：提供详细信息
return createErrorResponse(
  IpcErrorCode.FILE_NOT_FOUND,
  `File "${fileName}" not found in "${directory}"`
);
```

### 4. 使用 details 进行调试

对于复杂的错误，使用 `details` 字段提供额外的调试信息：

```typescript
return createErrorResponse(
  IpcErrorCode.OPERATION_FAILED,
  'Failed to process request',
  {
    originalError: error.message,
    stack: error.stack,
    context: { userId, requestId }
  }
);
```

### 5. 记录错误

始终使用结构化日志记录错误：

```typescript
return withIpcErrorHandling(async () => {
  // ... 操作
}, IpcErrorCode.OPERATION_FAILED)();
```

`withIpcErrorHandling` 会自动捕获错误并记录到日志中。

## 迁移现有代码

### 旧格式

```typescript
// 旧格式
ipcMain.handle('channel:name', async () => {
  try {
    const result = await doSomething();
    return { success: true, result };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
});
```

### 新格式

```typescript
// 新格式
ipcMain.handle('channel:name', async () => {
  return withIpcErrorHandling(async () => {
    const result = await doSomething();
    return createSuccessResponse(result);
  }, IpcErrorCode.OPERATION_FAILED)();
});
```

## 类型安全

所有 IPC handlers 应该定义明确的返回类型：

```typescript
import type { IpcResponse } from '../types/IpcResponse';

interface MyData {
  id: string;
  name: string;
}

ipcMain.handle('channel:name', async (): Promise<IpcResponse<MyData>> => {
  return withIpcErrorHandling(async () => {
    const data = await getData();
    return createSuccessResponse(data);
  }, IpcErrorCode.OPERATION_FAILED)();
});
```

## 测试

当测试 IPC handlers 时，确保测试错误路径：

```typescript
describe('My IPC Handler', () => {
  it('should return success response', async () => {
    const result = await handler(...args);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(expectedData);
  });

  it('should return error response on failure', async () => {
    const result = await handler(...invalidArgs);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(IpcErrorCode.INVALID_PARAMS);
    expect(result.error.message).toBeTruthy();
  });
});
```

## 总结

使用标准化的错误响应格式可以：

1. **提高一致性**：所有 handlers 使用相同的格式
2. **改善调试**：结构化的错误信息更容易追踪
3. **增强类型安全**：TypeScript 类型定义确保正确使用
4. **简化错误处理**：包装函数自动处理常见情况
5. **改善用户体验**：标准化的错误消息更容易本地化

如有疑问，请参考现有实现或联系后端团队。
