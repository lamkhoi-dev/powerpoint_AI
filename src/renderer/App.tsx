import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChatMessage as ChatMessageType, AppSettings } from './types'
import { useChat } from './hooks/useChat'
import { useVoiceInput } from './hooks/useVoiceInput'
import { useVoiceOutput } from './hooks/useVoiceOutput'
import { useDragWindow } from './hooks/useDragWindow'
import {
  IconBot, IconMic, IconSend, IconClose, IconSettings,
  IconBack, IconTrash, IconImage
} from './components/Icons'

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '', groqApiKey: '', aiProvider: 'auto', voiceEnabled: true, voiceSpeed: 1.0
}

export default function App() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [aiStatus, setAiStatus] = useState({ gemini: false, groq: false })
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; fileName: string } | null>(null)

  const { messages, isStreaming, sendMessage, clearMessages } = useChat(settings)
  const { isListening, transcript, interimTranscript, startListening, stopListening, isSupported: voiceSupported } = useVoiceInput()
  const { speak, isSpeaking } = useVoiceOutput(settings.voiceSpeed, settings.voiceEnabled)

  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Drag hooks
  const bubbleDrag = useDragWindow(() => handleExpand())
  const headerDrag = useDragWindow()

  useEffect(() => {
    window.electronAPI.getAllSettings().then(s => setSettings(s as AppSettings))
    window.electronAPI.getAiStatus().then(setAiStatus)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isListening && transcript) {
      setInputText(transcript)
      handleSend(transcript)
    }
  }, [isListening, transcript])

  useEffect(() => {
    if (!settings.voiceEnabled) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'assistant' && !lastMsg.isStreaming && lastMsg.content && !lastMsg.content.startsWith('⚠️')) {
      speak(lastMsg.content)
    }
  }, [messages, settings.voiceEnabled])

  const handleExpand = () => {
    setIsExpanded(true)
    window.electronAPI.expandWindow()
    setTimeout(() => inputRef.current?.focus(), 300)
  }
  const handleCollapse = () => {
    setIsExpanded(false)
    setView('chat')
    window.electronAPI.collapseWindow()
  }

  const handleSend = useCallback((text?: string) => {
    const content = text || inputText
    if (!content.trim() && !pendingImage) return
    sendMessage(content, pendingImage || undefined)
    setInputText('')
    setPendingImage(null)
  }, [inputText, pendingImage, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleImageUpload = async () => {
    const result = await window.electronAPI.openImage()
    if (!result || 'error' in result) return
    setPendingImage(result)
  }

  const handleSaveSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await window.electronAPI.setSetting(key, value)
    if (key === 'geminiApiKey' || key === 'groqApiKey') {
      setAiStatus(await window.electronAPI.getAiStatus())
    }
  }

  const handleMicToggle = () => {
    if (isListening) stopListening(); else startListening()
  }

  // ===================== BUBBLE MODE =====================
  if (!isExpanded) {
    return (
      <div className="bubble-container">
        <div className="chat-bubble" onMouseDown={bubbleDrag.onMouseDown}>
          <div className="bubble-camo-ring" />
          <div className="bubble-icon">
            <IconBot />
          </div>
          <div className="bubble-pulse" />
        </div>
      </div>
    )
  }

  // ===================== SETTINGS VIEW =====================
  if (view === 'settings') {
    return (
      <div className="app-container expanded">
        <div className="settings-panel">
          <div className="settings-header" onMouseDown={headerDrag.onMouseDown}>
            <button className="header-btn" onClick={() => setView('chat')}><IconBack /></button>
            <h2>Cài đặt</h2>
          </div>
          <div className="settings-content">
            <div className="settings-section">
              <div className="settings-section-title">Trạng thái AI</div>
              <div className="ai-status">
                <span className={`ai-status-badge ${aiStatus.gemini ? 'connected' : 'disconnected'}`}>
                  Gemini {aiStatus.gemini ? '● Kết nối' : '○ Chưa'}
                </span>
                <span className={`ai-status-badge ${aiStatus.groq ? 'connected' : 'disconnected'}`}>
                  Groq {aiStatus.groq ? '● Kết nối' : '○ Chưa'}
                </span>
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">API Keys</div>
              <div className="settings-field">
                <label className="settings-label">Gemini API Key</label>
                <input className="settings-input" type="password" placeholder="AIzaSy..."
                  value={settings.geminiApiKey} onChange={e => handleSaveSetting('geminiApiKey', e.target.value)} />
              </div>
              <div className="settings-field">
                <label className="settings-label">Groq API Key</label>
                <input className="settings-input" type="password" placeholder="gsk_..."
                  value={settings.groqApiKey} onChange={e => handleSaveSetting('groqApiKey', e.target.value)} />
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">AI Provider</div>
              <select className="settings-select" value={settings.aiProvider}
                onChange={e => handleSaveSetting('aiProvider', e.target.value)}>
                <option value="auto">Tự động (Gemini → Groq)</option>
                <option value="gemini">Chỉ Gemini</option>
                <option value="groq">Chỉ Groq</option>
              </select>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">Giọng nói</div>
              <div className="settings-toggle">
                <span className="settings-label">Đọc câu trả lời</span>
                <button className={`toggle-switch ${settings.voiceEnabled ? 'active' : ''}`}
                  onClick={() => handleSaveSetting('voiceEnabled', !settings.voiceEnabled)} />
              </div>
              {settings.voiceEnabled && (
                <div className="settings-field">
                  <label className="settings-label">Tốc độ: {settings.voiceSpeed}x</label>
                  <input type="range" min="0.5" max="2" step="0.1" className="settings-range"
                    value={settings.voiceSpeed} onChange={e => handleSaveSetting('voiceSpeed', parseFloat(e.target.value))} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===================== CHAT VIEW =====================
  const hasMessages = messages.length > 0

  return (
    <div className="app-container expanded">
      <div className="chat-panel">
        {/* Header - draggable */}
        <div className="chat-header" onMouseDown={headerDrag.onMouseDown}>
          <div className="chat-header-avatar"><IconBot /></div>
          <div className="chat-header-info">
            <div className="chat-header-title">Trợ lý Giảng bài</div>
            <div className="chat-header-status">
              {isStreaming ? 'Đang trả lời...' : isSpeaking ? '🔊 Đang đọc...' : '● Sẵn sàng'}
            </div>
          </div>
          <div className="chat-header-actions" onMouseDown={e => e.stopPropagation()}>
            <button className="header-btn" onClick={() => setView('settings')} title="Cài đặt"><IconSettings /></button>
            {hasMessages && <button className="header-btn" onClick={clearMessages} title="Xóa"><IconTrash /></button>}
            <button className="header-btn collapse-btn" onClick={handleCollapse} title="Thu nhỏ"><IconClose /></button>
          </div>
        </div>

        {/* Voice indicator */}
        {isListening && (
          <div className="voice-indicator">
            <div className="voice-wave">
              {[1,2,3,4,5].map(i => <div key={i} className="voice-wave-bar" />)}
            </div>
            <span>Đang nghe... {interimTranscript}</span>
          </div>
        )}

        {/* Messages or Welcome */}
        {!hasMessages ? (
          <div className="welcome-container">
            <div className="welcome-icon"><IconBot /></div>
            <div className="welcome-title">Trợ lý Giảng bài</div>
            <div className="welcome-subtitle">
              Xin chào Thủ trưởng! Tôi sẵn sàng hỗ trợ giảng bài. Hãy hỏi bất kỳ câu hỏi nào hoặc gửi hình ảnh tài liệu để phân tích.
            </div>
            {(!aiStatus.gemini && !aiStatus.groq) && (
              <button className="welcome-btn" onClick={() => setView('settings')}>
                <IconSettings /> Cấu hình API Key
              </button>
            )}
          </div>
        ) : (
          <div className="messages-container">
            {messages.map(msg => (
              <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                {msg.imageFileName && (
                  <div className="message-image-badge">📎 {msg.imageFileName}</div>
                )}
                <div className={`message-bubble ${msg.role} ${msg.content.startsWith('⚠️') ? 'error' : ''}`}>
                  {msg.content || (msg.isStreaming ? '' : '...')}
                  {msg.isStreaming && msg.content && <span className="cursor-blink">▊</span>}
                </div>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.content === '' && (
              <div className="message-wrapper assistant">
                <div className="typing-indicator">
                  <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Pending image */}
        {pendingImage && (
          <div className="pending-image">
            <span>📎 {pendingImage.fileName}</span>
            <button className="pending-image-remove" onClick={() => setPendingImage(null)}>✕</button>
          </div>
        )}

        {/* Input */}
        <div className="input-bar">
          <button className="input-btn image-btn" onClick={handleImageUpload} title="Gửi hình ảnh" disabled={isStreaming}>
            <IconImage />
          </button>
          {voiceSupported && (
            <button className={`input-btn mic-btn ${isListening ? 'recording' : ''}`}
              onClick={handleMicToggle} title={isListening ? 'Dừng' : 'Nói'}>
              <IconMic />
            </button>
          )}
          <div className="input-field-wrapper">
            <textarea ref={inputRef} className="input-field" rows={1}
              placeholder="Nhập câu hỏi..." value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown} disabled={isStreaming} />
          </div>
          <button className="input-btn send-btn" onClick={() => handleSend()}
            disabled={(!inputText.trim() && !pendingImage) || isStreaming} title="Gửi">
            <IconSend />
          </button>
        </div>
      </div>
    </div>
  )
}
