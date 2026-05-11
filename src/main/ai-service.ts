import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai'
import Groq from 'groq-sdk'

const SYSTEM_PROMPT = `Bạn là "Trợ lý Giảng bài" — trợ lý AI thông minh hỗ trợ cán bộ, sĩ quan trong quá trình giảng dạy và thuyết trình.

## Vai trò:
- Hỗ trợ giải đáp thắc mắc của học viên trong buổi giảng
- Cung cấp thông tin bổ sung, ví dụ minh họa khi được hỏi
- Phân tích hình ảnh tài liệu, sơ đồ, bảng biểu nếu được gửi kèm
- Giải thích rõ ràng, chính xác, có tính hệ thống

## Quy tắc:
- Trả lời bằng tiếng Việt, rõ ràng, mạch lạc
- Ngắn gọn, súc tích, đi thẳng vào trọng tâm (tối đa 3-4 đoạn)
- Sử dụng bullet points khi liệt kê
- Khi phân tích hình ảnh: mô tả chi tiết những gì nhìn thấy, sau đó giải thích
- Thái độ: tôn trọng, chuyên nghiệp, hỗ trợ tối đa
- Nếu không chắc chắn, nói rõ "Tôi không chắc chắn về điều này"`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  imageBase64?: string
  imageMimeType?: string
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (fullText: string) => void
  onError: (error: string) => void
}

class AIService {
  private geminiModel: GenerativeModel | null = null
  private geminiVisionModel: GenerativeModel | null = null
  private groqClient: Groq | null = null

  initGemini(apiKey: string): void {
    if (!apiKey) { this.geminiModel = null; this.geminiVisionModel = null; return }
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      this.geminiVisionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    } catch (error) {
      console.error('Gemini init error:', error)
      this.geminiModel = null
    }
  }

  initGroq(apiKey: string): void {
    if (!apiKey) { this.groqClient = null; return }
    try {
      this.groqClient = new Groq({ apiKey })
    } catch (error) {
      console.error('Groq init error:', error)
      this.groqClient = null
    }
  }

  async streamChat(
    messages: ChatMessage[],
    provider: 'gemini' | 'groq' | 'auto',
    callbacks: StreamCallbacks
  ): Promise<void> {
    const hasImage = messages.some(m => m.imageBase64)

    if (provider === 'auto') {
      if (this.geminiModel) {
        try {
          await this.streamGemini(messages, hasImage, callbacks)
          return
        } catch (error: any) {
          console.warn('Gemini failed, falling back to Groq:', error.message)
          if (this.groqClient && !hasImage) {
            await this.streamGroq(messages, callbacks)
            return
          }
          callbacks.onError(`Lỗi: ${error.message}`)
          return
        }
      }
      if (this.groqClient) {
        if (hasImage) {
          callbacks.onError('Groq không hỗ trợ phân tích ảnh. Vui lòng cấu hình Gemini API key.')
          return
        }
        await this.streamGroq(messages, callbacks)
        return
      }
      callbacks.onError('Chưa cấu hình API key. Bấm ⚙️ để thêm Gemini hoặc Groq API key.')
      return
    }

    if (provider === 'gemini') {
      if (!this.geminiModel) { callbacks.onError('Chưa cấu hình Gemini API key.'); return }
      await this.streamGemini(messages, hasImage, callbacks)
    } else {
      if (!this.groqClient) { callbacks.onError('Chưa cấu hình Groq API key.'); return }
      if (hasImage) { callbacks.onError('Groq không hỗ trợ phân tích ảnh.'); return }
      await this.streamGroq(messages, callbacks)
    }
  }

  private async streamGemini(
    messages: ChatMessage[],
    hasImage: boolean,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const model = hasImage ? this.geminiVisionModel : this.geminiModel
    if (!model) throw new Error('Gemini not initialized')

    const lastMessage = messages[messages.length - 1]
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }]
    }))

    const chat = model.startChat({
      history,
      systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] }
    })

    // Build parts for last message (text + optional image)
    const parts: Part[] = [{ text: lastMessage.content }]
    if (lastMessage.imageBase64 && lastMessage.imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: lastMessage.imageMimeType,
          data: lastMessage.imageBase64
        }
      })
    }

    const result = await chat.sendMessageStream(parts)
    let fullText = ''

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        fullText += text
        callbacks.onToken(text)
      }
    }
    callbacks.onDone(fullText)
  }

  private async streamGroq(
    messages: ChatMessage[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    if (!this.groqClient) throw new Error('Groq not initialized')

    const groqMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ]

    const stream = await this.groqClient.chat.completions.create({
      messages: groqMessages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 2048,
      stream: true
    })

    let fullText = ''
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        fullText += text
        callbacks.onToken(text)
      }
    }
    callbacks.onDone(fullText)
  }

  get isGeminiReady(): boolean { return this.geminiModel !== null }
  get isGroqReady(): boolean { return this.groqClient !== null }
}

export const aiService = new AIService()
