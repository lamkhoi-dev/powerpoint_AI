import { useCallback, useRef, useState } from 'react'

interface UseVoiceOutputReturn {
  speak: (text: string) => void
  stop: () => void
  isSpeaking: boolean
}

export function useVoiceOutput(speed: number = 1.0, enabled: boolean = true): UseVoiceOutputReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback((text: string) => {
    if (!enabled || !window.speechSynthesis) return

    window.speechSynthesis.cancel()

    const cleanText = text
      .replace(/[#*_`~]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, '. ')
      .trim()

    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'vi-VN'
    utterance.rate = speed
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Try to find Vietnamese voice
    const voices = window.speechSynthesis.getVoices()
    const viVoice = voices.find(v => v.lang.startsWith('vi'))
    if (viVoice) utterance.voice = viVoice

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [speed, enabled])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking }
}
