#!/usr/bin/env bun

/**
 * Claude Code Simplified - Ollama Edition
 *
 * A simplified version that supports:
 * - Ollama (DeepSeek R1, Llama, etc.)
 * - DuckDuckGo Web Search
 * - Web Fetch (URL content retrieval)
 *
 * Run with: bun run src/simple-cli.tsx
 */

import { createAnthropicCompatibleClient } from './services/api/ollamaClient.js'
import { search } from './services/search/ddgSearch.js'

interface Message {
	role: 'user' | 'assistant'
	content: string
}

class SimpleClaude {
	private client: ReturnType<typeof createAnthropicCompatibleClient>
	private model: string
	private messages: Message[] = []
	private systemPrompt =
		'You are a helpful AI assistant. You have access to web search and web fetch tools. When users ask about current information, search the web first. Format your responses using markdown.'

	constructor() {
		this.client = createAnthropicCompatibleClient()
		this.model = process.env.OLLAMA_MODEL || 'deepseek-r1:8b'
	}

	async chat(userInput: string): Promise<string> {
		this.messages.push({ role: 'user', content: userInput })

		const allMessages: Array<{ role: string; content: string }> = [
			{ role: 'system', content: this.systemPrompt },
			...this.messages,
		]

		try {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 4096,
				messages: allMessages,
				temperature: 0.7,
			})

			const assistantMessage =
				response.content[0]?.type === 'text'
					? response.content[0].text
					: 'Sorry, I could not process that.'

			this.messages.push({ role: 'assistant', content: assistantMessage })
			return assistantMessage
		} catch (error) {
			console.error('Error calling Ollama:', error)
			return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
		}
	}

	async chatWithTools(userInput: string): Promise<string> {
		this.messages.push({ role: 'user', content: userInput })

		const allMessages: Array<{ role: string; content: string }> = [
			{ role: 'system', content: this.systemPrompt },
			...this.messages,
		]

		// Check if user is asking for current information
		const needsSearch = /latest|recent|current|news|today|2024|2025|2026|search|find|look up/i.test(
			userInput,
		)

		let searchResults = ''
		if (needsSearch) {
			console.log('🔍 Searching the web...')
			const query = userInput
				.replace(/search|find|look up|latest|recent|current|news|what is|who is|what are/gi, '')
				.trim()
			const searchResponse = await search(query)
			searchResults = searchResponse.results
				.slice(0, 5)
				.map((r) => `- [${r.title}](${r.url})\n  ${r.snippet || ''}`)
				.join('\n')
			searchResults = `\n\nI found some relevant information:\n${searchResults}\n\nBased on this information, `
		}

		try {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 4096,
				messages: allMessages,
				temperature: 0.7,
			})

			let assistantMessage =
				response.content[0]?.type === 'text'
					? response.content[0].text
					: 'Sorry, I could not process that.'

			if (searchResults) {
				assistantMessage = searchResults + assistantMessage
			}

			this.messages.push({ role: 'assistant', content: assistantMessage })
			return assistantMessage
		} catch (error) {
			console.error('Error calling Ollama:', error)
			return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
		}
	}

	clearHistory() {
		this.messages = []
	}

	getHistory(): Message[] {
		return [...this.messages]
	}
}

async function main() {
	console.clear()
	console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          Claude Code - Ollama Edition                          ║
║          Local AI with Web Search                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Model: ${(process.env.OLLAMA_MODEL || 'deepseek-r1:8b').padEnd(52)}║
║  Base URL: ${(process.env.OLLAMA_BASE_URL || 'http://localhost:11434').padEnd(51)}║
╠═══════════════════════════════════════════════════════════════╣
║  Commands:                                                     ║
║    /search <query>  - Search the web                           ║
║    /clear           - Clear conversation history               ║
║    /history         - Show conversation history                ║
║    /quit            - Exit                                     ║
╚═══════════════════════════════════════════════════════════════╝
`)

	const claude = new SimpleClaude()
	const readline = await import('readline')

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	const prompt = () =>
		new Promise<string>((resolve) => {
			rl.question('\n👤 You: ', (answer) => {
				resolve(answer)
			})
		})

	console.log('\n💬 Start chatting! (type /help for commands)\n')

	while (true) {
		const input = await prompt()
		const trimmedInput = input.trim()

		if (!trimmedInput) continue

		if (trimmedInput === '/quit' || trimmedInput === '/exit' || trimmedInput === 'q') {
			console.log('\n👋 Goodbye!')
			break
		}

		if (trimmedInput === '/clear') {
			claude.clearHistory()
			console.log('✅ Conversation history cleared')
			continue
		}

		if (trimmedInput === '/history') {
			const history = claude.getHistory()
			console.log('\n📜 Conversation History:')
			history.forEach((msg, i) => {
				const role = msg.role === 'user' ? '👤' : '🤖'
				console.log(
					`  ${role} ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}`,
				)
			})
			continue
		}

		if (trimmedInput === '/help') {
			console.log(`
📚 Available Commands:
  /search <query>  - Search the web for information
  /clear           - Clear conversation history
  /history         - Show conversation history
  /quit            - Exit the program

💡 Tips:
  - Ask about current events, news, or recent information
  - The assistant will automatically search the web when needed
  - Use markdown formatting in your responses
`)
			continue
		}

		if (trimmedInput.startsWith('/search ')) {
			const query = trimmedInput.slice(8)
			console.log(`\n🔍 Searching for: "${query}"...`)
			try {
				const searchResponse = await search(query)
				console.log('\n📋 Search Results:\n')
				searchResponse.results.slice(0, 10).forEach((result, i) => {
					console.log(`${i + 1}. ${result.title}`)
					console.log(`   ${result.url}`)
					if (result.snippet) {
						console.log(`   ${result.snippet.slice(0, 200)}...`)
					}
					console.log()
				})
			} catch (error) {
				console.error('Search error:', error)
			}
			continue
		}

		// Check if this is a web search query
		const isSearchQuery =
			/latest|recent|current|news|today|search|find|look up|what is|who is|what are|how to|why is|when was/i.test(
				trimmedInput,
			)

		console.log('\n🤖 Assistant: ')
		console.log('─'.repeat(60))

		let response: string
		if (isSearchQuery) {
			response = await claude.chatWithTools(trimmedInput)
		} else {
			response = await claude.chat(trimmedInput)
		}

		console.log(response)
		console.log('─'.repeat(60))
	}

	rl.close()
}

main().catch(console.error)
