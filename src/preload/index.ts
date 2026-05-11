import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  expandWindow: () => void
  collapseWindow: () => void
  quitApp: () => void

  // Drag
  dragStart: (mousePos: { x: number; y: number }) => void
  dragMove: (mousePos: { x: number; y: number }) => void
  dragEnd: () => void

  // Image
  openImage: () => Promise<{ base64: string; mimeType: string; fileName: string } | { error: string } | null>

  // AI Chat
  sendChat: (payload: {
    messages: Array<{ role: string; content: string; imageBase64?: string; imageMimeType?: string }>
    provider: string
  }) => void
  onStreamToken: (callback: (token: string) => void) => () => void
  onStreamDone: (callback: (fullText: string) => void) => () => void
  onStreamError: (callback: (error: string) => void) => () => void
  getAiStatus: () => Promise<{ gemini: boolean; groq: boolean }>

  // Settings
  getSetting: (key: string) => Promise<any>
  setSetting: (key: string, value: any) => Promise<boolean>
  getAllSettings: () => Promise<{
    geminiApiKey: string
    groqApiKey: string
    aiProvider: string
    voiceEnabled: boolean
    voiceSpeed: number
  }>
}

const api: ElectronAPI = {
  expandWindow: () => ipcRenderer.send('window:expand'),
  collapseWindow: () => ipcRenderer.send('window:collapse'),
  quitApp: () => ipcRenderer.send('window:quit'),

  dragStart: (pos) => ipcRenderer.send('window:drag-start', pos),
  dragMove: (pos) => ipcRenderer.send('window:drag-move', pos),
  dragEnd: () => ipcRenderer.send('window:drag-end'),

  openImage: () => ipcRenderer.invoke('image:open-file'),

  sendChat: (payload) => ipcRenderer.send('ai:chat-stream', payload),
  onStreamToken: (callback) => {
    const handler = (_e: any, token: string) => callback(token)
    ipcRenderer.on('ai:stream-token', handler)
    return () => ipcRenderer.removeListener('ai:stream-token', handler)
  },
  onStreamDone: (callback) => {
    const handler = (_e: any, fullText: string) => callback(fullText)
    ipcRenderer.on('ai:stream-done', handler)
    return () => ipcRenderer.removeListener('ai:stream-done', handler)
  },
  onStreamError: (callback) => {
    const handler = (_e: any, error: string) => callback(error)
    ipcRenderer.on('ai:stream-error', handler)
    return () => ipcRenderer.removeListener('ai:stream-error', handler)
  },
  getAiStatus: () => ipcRenderer.invoke('ai:status'),

  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll')
}

contextBridge.exposeInMainWorld('electronAPI', api)
