import { ipcMain, dialog } from 'electron'
import { readFileSync } from 'fs'
import { aiService, ChatMessage, StreamCallbacks } from './ai-service'
import { getSetting, setSetting, getAllSettings } from './store'

export function setupIpcHandlers(): void {
  // --- Image picker ---
  ipcMain.handle('image:open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp'
    }

    try {
      const buffer = readFileSync(filePath)
      const base64 = buffer.toString('base64')
      return {
        base64,
        mimeType: mimeMap[ext] || 'image/png',
        fileName: filePath.split('/').pop() || filePath.split('\\').pop() || 'image'
      }
    } catch (error: any) {
      return { error: error.message }
    }
  })

  // --- AI Chat ---
  ipcMain.on('ai:chat-stream', async (event, payload: {
    messages: ChatMessage[]
    provider: 'gemini' | 'groq' | 'auto'
  }) => {
    const callbacks: StreamCallbacks = {
      onToken: (token) => event.sender.send('ai:stream-token', token),
      onDone: (fullText) => event.sender.send('ai:stream-done', fullText),
      onError: (error) => event.sender.send('ai:stream-error', error)
    }
    try {
      await aiService.streamChat(payload.messages, payload.provider, callbacks)
    } catch (error: any) {
      callbacks.onError(error.message || 'Lỗi không xác định')
    }
  })

  ipcMain.handle('ai:status', () => ({
    gemini: aiService.isGeminiReady,
    groq: aiService.isGroqReady
  }))

  // --- Settings ---
  ipcMain.handle('settings:get', (_event, key: string) => getSetting(key as any))
  ipcMain.handle('settings:set', (_event, key: string, value: any) => {
    setSetting(key as any, value)
    if (key === 'geminiApiKey') aiService.initGemini(value as string)
    else if (key === 'groqApiKey') aiService.initGroq(value as string)
    return true
  })
  ipcMain.handle('settings:getAll', () => getAllSettings())

  // Init AI from stored keys
  const geminiKey = getSetting('geminiApiKey')
  const groqKey = getSetting('groqApiKey')
  if (geminiKey) aiService.initGemini(geminiKey)
  if (groqKey) aiService.initGroq(groqKey)
}
