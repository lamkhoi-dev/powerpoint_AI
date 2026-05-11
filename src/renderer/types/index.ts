import { ElectronAPI } from '../../preload/index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  imageBase64?: string
  imageMimeType?: string
  imageFileName?: string
}

export interface AppSettings {
  geminiApiKey: string
  groqApiKey: string
  aiProvider: 'gemini' | 'groq' | 'auto'
  voiceEnabled: boolean
  voiceSpeed: number
}
