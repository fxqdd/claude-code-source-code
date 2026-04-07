#!/usr/bin/env bun

/**
 * Ollama + DuckDuckGo Search Test
 */

import { createAnthropicCompatibleClient } from './src/services/api/ollamaClient.js'
import { search } from './src/services/search/ddgSearch.js'

async function testOllama() {
	console.log('🧪 Testing Ollama Connection...\n')

	const client = createAnthropicCompatibleClient()

	console.log(`Model: ${client.model}`)
	console.log(`Base URL: ${client.baseUrl}\n`)

	// Test simple chat
	console.log('1️⃣ Testing Simple Chat...')
	try {
		const response = await client.messages.create({
			model: client.model,
			max_tokens: 100,
			messages: [{ role: 'user', content: 'Say "Hello from Ollama!" in exactly those words.' }],
			temperature: 0.7,
		})

		const text = response.content[0]?.type === 'text' ? response.content[0].text : 'No response'
		console.log(`   Response: ${text}`)
		console.log(`   ✅ Chat test passed!\n`)
	} catch (error) {
		console.error(`   ❌ Chat test failed: ${error}`)
	}

	// Test streaming chat
	console.log('2️⃣ Testing Streaming Chat...')
	try {
		let fullText = ''
		const count = 0

		for await (const event of client.messages.stream({
			model: client.model,
			max_tokens: 100,
			messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
		})) {
			if ('type' in event) {
				if (event.type === 'content_block_delta') {
					const delta = event.delta as { text?: string }
					if (delta?.text) {
						fullText += delta.text
						process.stdout.write(delta.text)
					}
				}
			}
		}
		console.log(`\n   ✅ Streaming test passed!\n`)
	} catch (error) {
		console.error(`   ❌ Streaming test failed: ${error}\n`)
	}
}

async function testSearch() {
	console.log('3️⃣ Testing DuckDuckGo Search...\n')

	try {
		const response = await search('DeepSeek AI 2026')

		console.log(`Query: ${response.query}`)
		console.log(`Results: ${response.results.length}\n`)

		response.results.slice(0, 3).forEach((result, i) => {
			console.log(`${i + 1}. ${result.title}`)
			console.log(`   ${result.url}`)
			if (result.snippet) {
				console.log(`   ${result.snippet.slice(0, 150)}...`)
			}
			console.log()
		})

		console.log('✅ Search test passed!\n')
	} catch (error) {
		console.error(`❌ Search test failed: ${error}\n`)
	}
}

async function main() {
	console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         Ollama + DuckDuckGo Search Integration Test           ║
╚═══════════════════════════════════════════════════════════════╝
`)

	await testOllama()
	await testSearch()

	console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    All Tests Complete!                         ║
╚═══════════════════════════════════════════════════════════════╝
`)
}

main().catch(console.error)
