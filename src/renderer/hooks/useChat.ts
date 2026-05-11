import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage, AppSettings } from '../types'

interface UseChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (content: string, image?: { base64: string; mimeType: string; fileName: string }) => void
  clearMessages: () => void
}

export function useChat(settings: AppSettings): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const streamTextRef = useRef('')
  const assistantIdRef = useRef('')

  useEffect(() => {
    const api = window.electronAPI

    const unsubToken = api.onStreamToken((token) => {
      streamTextRef.current += token
      const currentId = assistantIdRef.current
      setMessages(prev =>
        prev.map(m => m.id === currentId
          ? { ...m, content: streamTextRef.current, isStreaming: true }
          : m
        )
      )
    })

    const unsubDone = api.onStreamDone(() => {
      const currentId = assistantIdRef.current
      setMessages(prev =>
        prev.map(m => m.id === currentId ? { ...m, isStreaming: false } : m)
      )
      setIsStreaming(false)
    })

    const unsubError = api.onStreamError((error) => {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`, role: 'assistant',
        content: `⚠️ ${error}`, timestamp: Date.now()
      }
      const currentId = assistantIdRef.current
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== currentId)
        return [...filtered, errorMsg]
      })
      setIsStreaming(false)
    })

    return () => { unsubToken(); unsubDone(); unsubError() }
  }, [])

  const sendMessage = useCallback((content: string, image?: { base64: string; mimeType: string; fileName: string }) => {
    if ((!content.trim() && !image) || isStreaming) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`, role: 'user',
      content: content.trim() || (image ? 'Phân tích hình ảnh này' : ''),
      timestamp: Date.now(),
      imageBase64: image?.base64,
      imageMimeType: image?.mimeType,
      imageFileName: image?.fileName
    }

    const assistantId = `assistant-${Date.now()}`
    assistantIdRef.current = assistantId
    streamTextRef.current = ''

    const assistantMsg: ChatMessage = {
      id: assistantId, role: 'assistant', content: '',
      timestamp: Date.now(), isStreaming: true
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    const allMessages = [...messages, userMsg].map(m => ({
      role: m.role, content: m.content,
      ...(m.imageBase64 ? { imageBase64: m.imageBase64, imageMimeType: m.imageMimeType } : {})
    }))

    window.electronAPI.sendChat({
      messages: allMessages,
      provider: settings.aiProvider
    })
  }, [messages, isStreaming, settings.aiProvider])

  const clearMessages = useCallback(() => { setMessages([]) }, [])

  return { messages, isStreaming, sendMessage, clearMessages }
}
