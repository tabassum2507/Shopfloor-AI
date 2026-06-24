'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, X, Send, Loader2, Mic, Volume2, VolumeX } from 'lucide-react'

// ─── Web Speech API types (not in this TS lib version) ────────

interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative
  readonly length: number
  readonly isFinal: boolean
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult
  readonly length: number
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  lang:            string
  interimResults:  boolean
  maxAlternatives: number
  continuous:      boolean
  start():  void
  stop():   void
  abort():  void
  onstart:  ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror:  ((event: SpeechRecognitionErrorEvent) => void) | null
  onend:    ((event: Event) => void) | null
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance
}

// Window augmented with vendor prefix
type WinSR = Window & {
  SpeechRecognition?:       SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

function getSRClass(): SpeechRecognitionCtor | null {
  const W = window as WinSR
  return W.SpeechRecognition ?? W.webkitSpeechRecognition ?? null
}

// ─── Types ────────────────────────────────────────────────────

type Role    = 'user' | 'assistant'
type Message = { id: string; role: Role; content: string; streaming?: boolean }

// ─── Constants ────────────────────────────────────────────────

const CHIPS = [
  "What's overdue?",
  "Today's production output?",
  "Where's the bottleneck?",
  "Stock levels OK?",
  "Aaj kitne orders pending hain?",
  "Kaunsa material kam hai?",
]

// ─── Sub-components ───────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-0.5 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AiAssistant({ isOpen, onClose }: Props) {
  const [messages,   setMessages]   = useState<Message[]>([])
  const [input,      setInput]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [listening,  setListening]  = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [hasMic,     setHasMic]     = useState(false)
  const [hasTTS,     setHasTTS]     = useState(false)

  const bottomRef      = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Detect Web Speech API availability (client-side only)
  useEffect(() => {
    setHasMic(getSRClass() !== null)
    setHasTTS('speechSynthesis' in window)
  }, [])

  // Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 320)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Stop voice I/O when panel closes
  useEffect(() => {
    if (!isOpen) {
      recognitionRef.current?.stop()
      setListening(false)
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      setSpeakingId(null)
    }
  }, [isOpen])

  // ── Send ─────────────────────────────────────────────────

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    // Stop any TTS that's playing
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeakingId(null)

    const userMsg: Message = {
      id:      crypto.randomUUID(),
      role:    'user',
      content: trimmed,
    }

    const history = messages
      .filter(m => !m.streaming && m.content)
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setBusy(true)

    const aiId = crypto.randomUUID()
    setMessages(prev => [
      ...prev,
      { id: aiId, role: 'assistant', content: '', streaming: true },
    ])

    try {
      const res = await fetch('/api/ai/query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: trimmed, history }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Request failed')
      }

      const reader    = res.body.getReader()
      const decoder   = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const snap = accumulated
        setMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, content: snap } : m)
        )
      }

      setMessages(prev =>
        prev.map(m => m.id === aiId ? { ...m, streaming: false } : m)
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages(prev =>
        prev.map(m =>
          m.id === aiId ? { ...m, content: msg, streaming: false } : m
        )
      )
    } finally {
      setBusy(false)
    }
  }

  // ── Voice input ───────────────────────────────────────────

  function startListening() {
    const SRClass = getSRClass()
    if (!SRClass) return

    const recognition = new SRClass()
    recognition.lang            = 'en-IN'  // handles English + Hinglish
    recognition.interimResults  = true     // show partial transcript while speaking
    recognition.maxAlternatives = 1
    recognition.continuous      = false

    recognition.onstart = () => {
      console.log('[Speech] onstart — mic is active')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final   = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const text   = result[0].transcript
        if (result.isFinal) final += text
        else                interim += text
      }

      console.log('[Speech] onresult — interim:', interim, '| final:', final)

      // Show partial text in the input field while the user is still speaking
      setInput(interim || final)

      if (final) {
        setListening(false)
        sendMessage(final)
      }
    }

    recognition.onerror = (e) => {
      console.error('[Speech] onerror —', e.error)
      // Common causes:
      //   'not-allowed'  → mic permission denied in browser
      //   'no-speech'    → mic heard nothing (timeout)
      //   'network'      → Speech API needs an internet connection (sends audio to Google)
      //   'aborted'      → stop() was called manually
      setListening(false)
    }

    recognition.onend = () => {
      console.log('[Speech] onend')
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  // ── Voice output ──────────────────────────────────────────

  function toggleSpeak(msg: Message) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    if (speakingId === msg.id) {
      setSpeakingId(null)
      return
    }

    const utterance   = new SpeechSynthesisUtterance(msg.content)
    utterance.lang    = 'en-IN'
    utterance.rate    = 1.05
    utterance.onend   = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)

    setSpeakingId(msg.id)
    window.speechSynthesis.speak(utterance)
  }

  // ── Form handlers ─────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') onClose()
  }

  const showChips = messages.length === 0

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden
        className={[
          'fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px]',
          'transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <aside
        className={[
          'fixed right-0 top-0 h-screen z-[60]',
          'flex flex-col bg-white',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ width: 400, boxShadow: '-8px 0 40px rgba(0,0,0,0.14)' }}
        aria-label="AI Assistant"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-[14px] border-b border-gray-100 shrink-0">
          <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: '#1E3A5F18' }}>
            <Bot style={{ width: 16, height: 16, color: '#1E3A5F' }} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-gray-800 leading-none">AI Assistant</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-none">
              {hasMic
                ? 'Llama 3.3 · Voice-enabled · Hindi / English'
                : 'Llama 3.3 · Shop floor queries'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close AI Assistant"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Message area ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* Suggestion chips */}
          {showChips && (
            <div className="space-y-3 pt-2">
              <p className="text-center text-[11.5px] font-medium text-gray-400 uppercase tracking-wide">
                Suggested questions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className={[
                      'text-left p-3 rounded-xl border border-gray-200 bg-gray-50',
                      'hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary',
                      'text-[12.5px] text-gray-600 leading-snug transition-all',
                    ].join(' ')}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              {hasMic && (
                <p className="text-center text-[11px] text-gray-400">
                  Mic active — speak in Hindi or English
                </p>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* AI avatar */}
              {msg.role === 'assistant' && (
                <div
                  className="w-6 h-6 rounded-full shrink-0 mb-[18px] flex items-center justify-center"
                  style={{ backgroundColor: '#1E3A5F18' }}
                >
                  <Bot style={{ width: 12, height: 12, color: '#1E3A5F' }} />
                </div>
              )}

              {/* Bubble + read-aloud button stacked */}
              <div className={`flex flex-col gap-1 max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={[
                    'px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed',
                    msg.role === 'user'
                      ? 'rounded-br-[4px] text-white'
                      : 'rounded-bl-[4px] bg-gray-100 text-gray-800',
                  ].join(' ')}
                  style={msg.role === 'user' ? { backgroundColor: '#1E3A5F' } : undefined}
                >
                  {msg.content === '' && msg.streaming
                    ? <TypingDots />
                    : <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                  }
                </div>

                {/* Read-aloud button — only on completed AI messages */}
                {msg.role === 'assistant' && !msg.streaming && msg.content && hasTTS && (
                  <button
                    onClick={() => toggleSpeak(msg)}
                    aria-label={speakingId === msg.id ? 'Stop speaking' : 'Read aloud'}
                    className={[
                      'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] transition-colors',
                      speakingId === msg.id
                        ? 'text-primary bg-primary/10'
                        : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    {speakingId === msg.id
                      ? <><VolumeX style={{ width: 11, height: 11 }} /> Stop</>
                      : <><Volume2 style={{ width: 11, height: 11 }} /> Read aloud</>
                    }
                  </button>
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 border-t border-gray-100 px-4 py-3">

          {/* Recording status strip */}
          {listening && (
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[11.5px] font-medium text-red-500">Listening… speak now</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">

            {/* Mic button */}
            {hasMic ? (
              <div className="relative group/mic shrink-0">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  disabled={busy}
                  aria-label={listening ? 'Stop recording' : 'Start voice input'}
                  className={[
                    'relative p-2.5 rounded-xl transition-all overflow-hidden',
                    listening
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
                    busy ? 'opacity-40 pointer-events-none' : '',
                  ].join(' ')}
                >
                  {listening && (
                    <span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-40" />
                  )}
                  <Mic style={{ width: 15, height: 15 }} className="relative" />
                </button>
                {/* Tooltip */}
                {!listening && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                    <span className="block opacity-0 group-hover/mic:opacity-100 transition-opacity duration-150 whitespace-nowrap bg-gray-900 text-white text-[10.5px] font-medium px-2 py-1 rounded-md shadow-lg">
                      Speak in English or Hindi
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group/mic shrink-0">
                <button
                  type="button"
                  disabled
                  aria-label="Voice not supported in this browser"
                  className="p-2.5 rounded-xl bg-gray-100 text-gray-300 cursor-not-allowed"
                >
                  <Mic style={{ width: 15, height: 15 }} />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                  <span className="block opacity-0 group-hover/mic:opacity-100 transition-opacity duration-150 whitespace-nowrap bg-gray-900 text-white text-[10.5px] font-medium px-2 py-1 rounded-md shadow-lg">
                    Voice not supported in this browser
                  </span>
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? 'Listening…' : 'Ask about orders, stock, delays…'}
              disabled={busy}
              className={[
                'flex-1 px-3.5 py-2.5 rounded-xl border bg-gray-50',
                'text-[13px] placeholder:text-gray-300',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white',
                'disabled:opacity-60 transition-all',
                listening
                  ? 'border-red-200 bg-red-50/40 placeholder:text-red-300'
                  : 'border-gray-200',
              ].join(' ')}
            />

            <button
              type="submit"
              disabled={!input.trim() || busy}
              aria-label="Send message"
              className="p-2.5 rounded-xl text-white disabled:opacity-40 transition-all shrink-0 hover:opacity-90"
              style={{ backgroundColor: '#1E3A5F' }}
            >
              {busy
                ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                : <Send style={{ width: 15, height: 15 }} />
              }
            </button>
          </form>

          {/* Hint */}
          <p className="text-center text-[10.5px] text-gray-300 mt-2 leading-relaxed">
            {hasMic
              ? <>Try: <span className="text-gray-400 font-medium">&quot;Aaj kitne orders pending hain?&quot;</span></>
              : 'Only shop floor data — powered by Groq'
            }
          </p>
        </div>
      </aside>
    </>
  )
}
