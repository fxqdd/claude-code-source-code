#!/usr/bin/env bun

/**
 * DuckDuckGo Search Test Only
 */

async function testDuckDuckGoSearch() {
	console.log('🔍 Testing DuckDuckGo Search...\n')

	const queries = ['DeepSeek AI 2026', 'latest technology news', 'AI developments today']

	for (const query of queries) {
		console.log(`\n📌 Query: "${query}"`)
		console.log('─'.repeat(50))

		try {
			// Use DDG Instant Answer API
			const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`

			const response = await fetch(url, {
				headers: {
					Accept: 'application/json',
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
				},
			})

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			const data = await response.json()

			const results: Array<{ title: string; url: string; snippet: string }> = []

			// Add abstract if available
			if (data.AbstractText) {
				results.push({
					title: data.Heading || query,
					url: data.AbstractURL || '',
					snippet: data.AbstractText,
				})
			}

			// Add related topics
			if (data.RelatedTopics) {
				for (const topic of data.RelatedTopics.slice(0, 5)) {
					if (topic.Text && topic.FirstURL) {
						results.push({
							title: data.Heading || query,
							url: topic.FirstURL,
							snippet: topic.Text,
						})
					}
				}
			}

			if (results.length === 0) {
				console.log('   No results found')
			} else {
				results.slice(0, 5).forEach((result, i) => {
					console.log(`\n   ${i + 1}. ${result.title}`)
					console.log(`      URL: ${result.url}`)
					if (result.snippet) {
						console.log(`      ${result.snippet.slice(0, 200)}...`)
					}
				})
			}

			console.log('\n   ✅ Search successful!')
		} catch (error) {
			console.error(`   ❌ Search failed: ${error}`)
		}
	}
}

async function testDDGLite() {
	console.log('\n\n🌐 Testing DDG Lite HTML Parsing...\n')

	const query = 'AI news'
	console.log(`📌 Query: "${query}"`)
	console.log('─'.repeat(50))

	try {
		const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`

		const response = await fetch(url, {
			headers: {
				Accept: 'text/html',
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			},
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const html = await response.text()

		// Parse results from HTML
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

		for (let i = 0; i < Math.min(links.length, 10); i++) {
			results.push({
				title: links[i].title,
				url: links[i].url,
				snippet: snippets[i] || '',
			})
		}

		console.log(`\n   Found ${results.length} results:\n`)
		results.slice(0, 5).forEach((result, i) => {
			console.log(`   ${i + 1}. ${result.title}`)
			console.log(`      ${result.url}`)
			if (result.snippet) {
				console.log(`      ${result.snippet.slice(0, 150)}...`)
			}
			console.log()
		})

		console.log('   ✅ DDG Lite parsing successful!')
	} catch (error) {
		console.error(`   ❌ DDG Lite failed: ${error}`)
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
║              DuckDuckGo Search Test                           ║
╚═══════════════════════════════════════════════════════════════╝
`)

	await testDuckDuckGoSearch()
	await testDDGLite()

	console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Tests Complete!                             ║
╚═══════════════════════════════════════════════════════════════╝
`)
}

main().catch(console.error)
