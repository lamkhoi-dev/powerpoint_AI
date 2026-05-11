import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

interface StoreSchema {
  geminiApiKey: string
  groqApiKey: string
  aiProvider: 'gemini' | 'groq' | 'auto'
  voiceEnabled: boolean
  voiceSpeed: number
}

const DEFAULTS: StoreSchema = {
  geminiApiKey: '',
  groqApiKey: '',
  aiProvider: 'auto',
  voiceEnabled: true,
  voiceSpeed: 1.0
}

let data: StoreSchema = { ...DEFAULTS }
let storePath = ''

export function initStore(): void {
  const userDataPath = app.getPath('userData')
  const configDir = join(userDataPath, 'config')
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })

  storePath = join(configDir, 'settings.json')

  if (existsSync(storePath)) {
    try {
      const raw = readFileSync(storePath, 'utf-8')
      const parsed = JSON.parse(raw)
      data = { ...DEFAULTS, ...parsed }
    } catch {
      data = { ...DEFAULTS }
    }
  } else {
    save()
  }
}

function save(): void {
  try {
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

export function getSetting<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
  return data[key]
}

export function setSetting<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
  data[key] = value
  save()
}

export function getAllSettings(): StoreSchema {
  return { ...data }
}

export type { StoreSchema }
