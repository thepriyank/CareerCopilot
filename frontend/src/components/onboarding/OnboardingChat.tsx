'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { profile as profileApi } from '@/lib/api'
import { OnboardingState, OnboardingTurn } from '@/types'
import Button from '@/components/ui/Button'

interface Message {
  role: 'bot' | 'user'
  text: string
}

interface QuickReply {
  label: string
  value: string
}

const QUICK_REPLIES: Partial<Record<OnboardingState, QuickReply[]>> = {
  REMOTE_PREFERENCE: [
    { label: 'Remote only', value: 'Remote only' },
    { label: 'Hybrid', value: 'Hybrid' },
    { label: 'On-site', value: 'On-site' },
    { label: 'Open to all', value: 'Open to all options' },
  ],
  URGENCY: [
    { label: 'Actively applying', value: 'Actively looking and applying' },
    { label: 'Open to opportunities', value: 'Open to opportunities but not urgently' },
    { label: 'Just exploring', value: 'Not looking right now' },
  ],
  SALARY: [
    { label: 'Skip', value: 'skip' },
  ],
  NOTICE_PERIOD: [
    { label: 'Immediate', value: 'Immediately available' },
    { label: '2 weeks', value: '2 weeks' },
    { label: '1 month', value: '1 month' },
    { label: 'Skip', value: 'skip' },
  ],
  VISA_STATUS: [
    { label: 'No constraints', value: 'No visa constraints' },
    { label: 'Need sponsorship', value: 'Require sponsorship' },
    { label: 'Skip', value: 'skip' },
  ],
}

const WELCOME_MESSAGE =
  "Welcome to Jobmagnate! I'm going to ask you a few quick questions to build your career profile. Let's start: what job titles or roles are you targeting? (e.g., \"Senior Product Manager\", \"Data Scientist\", \"Full-Stack Engineer\")"

interface OnboardingChatProps {
  initialState?: OnboardingState
  onComplete?: (score: number) => void
}

export default function OnboardingChat({
  initialState = 'WELCOME',
  onComplete,
}: OnboardingChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: WELCOME_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [currentState, setCurrentState] = useState<OnboardingState>(initialState)
  const [loading, setLoading] = useState(false)
  const [completionScore, setCompletionScore] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const result: OnboardingTurn = await profileApi.onboarding(text.trim(), currentState)
      const botMsg: Message = { role: 'bot', text: result.message }
      setMessages((prev) => [...prev, botMsg])
      setCurrentState(result.state)
      setCompletionScore(result.completionScore)

      if (result.isComplete) {
        setIsComplete(true)
        onComplete?.(result.completionScore)
      }
    } catch (err: unknown) {
      const errMsg: Message = {
        role: 'bot',
        text: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'unknown error'}. Please try again.`,
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const quickReplies = QUICK_REPLIES[currentState] ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Profile completion</span>
          <span className="font-medium text-slate-700">{completionScore}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${completionScore}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={[
                'max-w-sm px-4 py-3 text-sm leading-relaxed',
                msg.role === 'bot' ? 'bubble-bot text-slate-800' : 'bubble-user',
              ].join(' ')}
            >
              {msg.role === 'bot' && (
                <span className="text-xs font-semibold text-primary-600 block mb-1">
                  Jobmagnate
                </span>
              )}
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bubble-bot px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!isComplete && (
        <div className="px-6 py-4 border-t border-slate-100 bg-white space-y-3">
          {quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((qr) => (
                <button
                  key={qr.value}
                  onClick={() => sendMessage(qr.value)}
                  disabled={loading}
                  className="text-xs border border-slate-300 rounded-full px-3 py-1 text-slate-600 hover:bg-slate-100 hover:border-primary-400 hover:text-primary-700 transition-colors disabled:opacity-50"
                >
                  {qr.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer… (Enter to send)"
              disabled={loading}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              loading={loading}
              size="sm"
              className="self-end"
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="px-6 py-4 border-t border-slate-100 bg-green-50 text-center">
          <p className="text-sm font-semibold text-green-800">
            ✓ Profile complete! Your career profile is set up.
          </p>
        </div>
      )}
    </div>
  )
}
