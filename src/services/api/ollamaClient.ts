import { randomUUID } from 'crypto'
import { getUserAgent } from 'src/utils/http.js'
import { getSessionId } from '../../bootstrap/state.js'
import { isDebugToStdErr, logForDebugging } from '../../utils/debug.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OllamaChatRequest {
  model: string
  messages: OllamaMessage[]
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    num_predict?: number
  }
}

export interface OllamaChatResponse {
  model: string
  message: {
    role: 'assistant'
    content: string
  }
  done: boolean
  total_duration?: number
  eval_count?: number
  eval_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  context?: number[]
}

export interface OllamaStreamResponse {
  model: string
  created_at: string
  message: {
    role: 'assistant'
    content: string
  }
  done: boolean
  partial: boolean
}

export type StreamEventType =
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_start'
  | 'message_delta'
  | 'message_stop'
  | 'error'

export interface StreamEvent {
  type: 'stream_event'
  event: {
    type: StreamEventType
    content_block?: {
      type: 'thinking' | 'text'
      text?: string
      thinking?: string
    }
    delta?: {
      type: 'input_json_delta' | 'text_delta'
      partial_json?: string
      text?: string
    }
    usage?: {
      input_tokens: number
      output_tokens: number
    }
  }
}

function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
}

function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || 'deepseek-r1:8b'
}

function getOllamaApiKey(): string | undefined {
  return process.env.OLLAMA_API_KEY
}

function createOllamaClient() {
  const baseUrl = getOllamaBaseUrl()
  const model = getOllamaModel()
  const apiKey = getOllamaApiKey()

  async function ollamaChat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const url = `${baseUrl}/api/chat`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': getUserAgent(),
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...request,
        model: request.model || model,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  async function* streamChat(
    request: OllamaChatRequest,
  ): AsyncGenerator<StreamEvent | OllamaChatResponse, void> {
    const url = `${baseUrl}/api/chat`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': getUserAgent(),
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...request,
        model: request.model || model,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    if (!response.body) {
      throw new Error('Ollama API response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let finalResponse: OllamaChatResponse | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data: OllamaStreamResponse = JSON.parse(line)

            if (data.message?.content) {
              fullContent += data.message.content

              yield {
                type: 'stream_event',
                event: {
                  type: 'content_block_delta',
                  delta: {
                    type: 'text_delta',
                    text: data.message.content,
                  },
                },
              } as StreamEvent
            }

            if (data.done) {
              finalResponse = {
                model: data.model,
                message: {
                  role: 'assistant',
                  content: fullContent,
                },
                done: true,
              }
              break
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (finalResponse) {
      yield finalResponse
    }
  }

  return {
    chat: ollamaChat,
    streamChat,
    model,
  }
}

export function createAnthropicCompatibleClient() {
  const ollama = createOllamaClient()

  async function messagesCreate(
    params: {
      model?: string
      max_tokens?: number
      messages?: Array<{ role: string; content: string | Array<unknown> }>
      system?: Array<{ type: string; text: string }>
      stream?: boolean
      temperature?: number
      tools?: Array<{ type: string; name: string; description?: string; input_schema?: object }>
    },
    options?: { signal?: AbortSignal; timeout?: number },
  ): Promise<{
    id: string
    type: string
    role: string
    content: Array<{ type: string; text?: string; id?: string }>
    model: string
    stop_reason: string | null
    stop_sequence: number | null
    usage: { input_tokens: number; output_tokens: number }
  }> {
    const model = params.model || ollama.model
    const maxTokens = params.max_tokens || 4096

    const systemContent = params.system
      ?.filter((s) => s.type === 'text')
      ?.map((s) => s.text)
      ?.join('\n') || ''

    const ollamaMessages: OllamaMessage[] = []

    if (systemContent) {
      ollamaMessages.push({ role: 'system', content: systemContent })
    }

    for (const msg of params.messages || []) {
      const content = Array.isArray(msg.content)
        ? msg.content.map((c) => (typeof c === 'string' ? c : (c as { text?: string }).text || '')).join('\n')
        : msg.content

      ollamaMessages.push({
        role: msg.role as 'user' | 'assistant',
        content,
      })
    }

    const request: OllamaChatRequest = {
      model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: params.temperature,
        num_predict: maxTokens,
      },
    }

    if (isDebugToStdErr()) {
      logForDebugging(`[Ollama] Request: ${JSON.stringify(request, null, 2)}`)
    }

    const response = await ollama.chat(request)

    if (isDebugToStdErr()) {
      logForDebugging(`[Ollama] Response: ${JSON.stringify(response, null, 2)}`)
    }

    return {
      id: `ollama-${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: response.message.content,
        },
      ],
      model: response.model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: response.prompt_eval_count || 0,
        output_tokens: response.eval_count || response.message.content.length / 4,
      },
    }
  }

  async function* messagesStream(
    params: {
      model?: string
      max_tokens?: number
      messages?: Array<{ role: string; content: string | Array<unknown> }>
      system?: Array<{ type: string; text: string }>
      temperature?: number
    },
    options?: { signal?: AbortSignal; timeout?: number },
  ): AsyncGenerator<
    | { type: 'message_start'; message: { id: string; type: string; role: string; content: Array<{ type: string; text?: string }>; model: string; stop_reason: null; stop_sequence: null; usage: { input_tokens: number; output_tokens: number } } }
    | { type: 'content_block_start'; index: number; content_block: { type: 'thinking' | 'text'; thinking?: string; text?: string } }
    | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } }
    | { type: 'content_block_stop'; index: number }
    | { type: 'message_delta'; delta: { stop_reason: string }; usage: { input_tokens: number; output_tokens: number } }
    | { type: 'message_stop' }
    | { type: 'error'; error: { type: string; message: string } }
  > {
    const model = params.model || ollama.model
    const maxTokens = params.max_tokens || 4096

    const systemContent = params.system
      ?.filter((s) => s.type === 'text')
      ?.map((s) => s.text)
      ?.join('\n') || ''

    const ollamaMessages: OllamaMessage[] = []

    if (systemContent) {
      ollamaMessages.push({ role: 'system', content: systemContent })
    }

    for (const msg of params.messages || []) {
      const content = Array.isArray(msg.content)
        ? msg.content.map((c) => (typeof c === 'string' ? c : (c as { text?: string }).text || '')).join('\n')
        : msg.content

      ollamaMessages.push({
        role: msg.role as 'user' | 'assistant',
        content,
      })
    }

    const request: OllamaChatRequest = {
      model,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: params.temperature,
        num_predict: maxTokens,
      },
    }

    if (isDebugToStdErr()) {
      logForDebugging(`[Ollama] Stream Request: ${JSON.stringify(request, null, 2)}`)
    }

    const messageId = `ollama-${randomUUID()}`
    let inputTokens = 0
    let outputTokens = 0

    yield {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    }

    yield {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'text',
        text: '',
      },
    }

    let fullText = ''

    for await (const event of ollama.streamChat(request)) {
      if (event.type === 'stream_event') {
        if (event.event.delta?.type === 'text_delta' && event.event.delta.text) {
          fullText += event.event.delta.text
          outputTokens++

          yield {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: event.event.delta.text,
            },
          }
        }
      } else if ('message' in event && event.message) {
        inputTokens = (event as unknown as { prompt_eval_count?: number }).prompt_eval_count || 0
        outputTokens = (event as unknown as { eval_count?: number }).eval_count || 0
      }
    }

    yield {
      type: 'content_block_stop',
      index: 0,
    }

    yield {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    }

    yield {
      type: 'message_stop',
    }
  }

  return {
    messages: {
      create: messagesCreate,
      stream: messagesStream,
    },
    baseUrl: getOllamaBaseUrl(),
    model: ollama.model,
  }
}

export type OllamaCompatibleClient = ReturnType<typeof createAnthropicCompatibleClient>
