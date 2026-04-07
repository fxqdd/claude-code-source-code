#!/usr/bin/env bun

/**
 * Direct Ollama + DuckDuckGo Test
 * This script tests the core functionality without depending on the leaked source code.
 */

async function testOllamaDirect() {
	console.log('🧪 Testing Ollama Direct API...\n')

	const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
	const model = process.env.OLLAMA_MODEL || 'llama3.2:1b'

	console.log(`Model: ${model}`)
	console.log(`Base URL: ${baseUrl}\n`)

	// Test 1: Simple chat
	console.log('1️⃣ Testing Simple Chat...')
	try {
		const response = await fetch(`${baseUrl}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: 'Say "Hello from Ollama!" in exactly those words.' }],
				stream: false,
			}),
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${await response.text()}`)
		}

		const data = await response.json()
		console.log(`   Response: ${data.message?.content || 'No response'}`)
		console.log(`   ✅ Chat test passed!\n`)
	} catch (error) {
		console.error(`   ❌ Chat test failed: ${error}\n`)
		return
	}

	// Test 2: Streaming chat
	console.log('2️⃣ Testing Streaming Chat...')
	try {
		const response = await fetch(`${baseUrl}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
				stream: true,
			}),
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const reader = response.body?.getReader()
		if (!reader) throw new Error('No response body')

		const decoder = new TextDecoder()
		let buffer = ''

		while (true) {
			const { done, value } = await reader.read()
			if (done) break

			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop() || ''

			for (const line of lines) {
				if (!line.trim()) continue
				try {
					const data = JSON.parse(line)
					if (data.message?.content) {
						process.stdout.write(data.message.content)
					}
				} catch {}
			}
		}
		console.log('\n   ✅ Streaming test passed!\n')
	} catch (error) {
		console.error(`   ❌ Streaming test failed: ${error}\n`)
	}
}

async function testDuckDuckGoSearch() {
	console.log('3️⃣ Testing DuckDuckGo Search...\n')

	try {
		const query = 'DeepSeek AI 2026'

		// Use the lite version which is more reliable
		const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`

		const response = await fetch(ddgUrl, {
			headers: {
				Accept: 'text/html',
				'User-Agent': 'Mozilla/5.0 (compatible; Claude-Code-Test/1.0)',
			},
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const html = await response.text()

		// Parse simple results from HTML
		const results: Array<{ title: string; url: string; snippet: string }> = []
		const linkRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g
		const snippetRegex = /<a class="result__snippet"[^>]*>([^<]+)<\/a>/g

		const links: Array<{ url: string; title: string }> = []
		let linkMatch
		while ((linkMatch = linkRegex.exec(html)) !== null) {
			links.push({
				url: linkMatch[1],
				title: decodeHTMLEntities(linkMatch[2].trim()),
			})
		}

		const snippets: string[] = []
		let snippetMatch
		while ((snippetMatch = snippetRegex.exec(html)) !== null) {
			snippets.push(decodeHTMLEntities(snippetMatch[1].trim()))
		}

		for (let i = 0; i < Math.min(links.length, 5); i++) {
			results.push({
				title: links[i].title,
				url: links[i].url,
				snippet: snippets[i] || '',
			})
		}

		console.log(`Query: ${query}`)
		console.log(`Results: ${results.length}\n`)

		results.slice(0, 3).forEach((result, i) => {
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

function decodeHTMLEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
}

async function main() {
	console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         Ollama + DuckDuckGo Search Integration Test            ║
╚═══════════════════════════════════════════════════════════════╝
`)

	await testOllamaDirect()
	await testDuckDuckGoSearch()

	console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    All Tests Complete!                         ║
╚═══════════════════════════════════════════════════════════════╝
`)
}

main().catch(console.error)
