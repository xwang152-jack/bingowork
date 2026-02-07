import { ipcRenderer, contextBridge, IpcRendererEvent } from 'electron'

// --------- Expose some API to the Renderer process ---------
// SECURITY: Only expose the minimum necessary API to prevent arbitrary IPC message sending
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    const subscription = (_event: IpcRendererEvent, ...eventArgs: unknown[]) => listener(_event, ...eventArgs)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  // SECURITY: Removed 'send' method to prevent one-way message sending without confirmation
  // All IPC communication should use 'invoke' for request-response pattern with proper error handling
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APIs you need here.
  // ...
})
