export interface SearchResult {
  title: string
  url: string
  snippet?: string
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
}

function getDuckDuckGoUrl(query: string): string {
  return `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
}

function getDDGInstantAnswerUrl(query: string): string {
  return `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
}

export async function searchWithDDGInstantAnswer(
  query: string,
): Promise<SearchResponse> {
  const url = getDDGInstantAnswerUrl(query)

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Claude Code/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`DDG Instant Answer API error: ${response.status}`)
    }

    const data = await response.json()

    const results: SearchResult[] = []

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: data.Heading || query,
            url: topic.FirstURL,
            snippet: topic.Text,
          })
        }
      }
    }

    if (data.AbstractText) {
      results.unshift({
        title: data.Heading || query,
        url: data.AbstractURL || '',
        snippet: data.AbstractText,
      })
    }

    return {
      query,
      results: results.slice(0, 20),
    }
  } catch (error) {
    console.error('DDG Instant Answer search failed:', error)
    return {
      query,
      results: [],
    }
  }
}

export async function searchWithDDGLite(
  query: string,
): Promise<SearchResponse> {
  const url = getDuckDuckGoUrl(query)

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; Claude Code/1.0)',
      },
    })

    if (!response.ok) {
      throw new Error(`DDG Lite API error: ${response.status}`)
    }

    const html = await response.text()

    const results: SearchResult[] = []

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

    for (let i = 0; i < links.length; i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || '',
      })
    }

    return {
      query,
      results: results.slice(0, 20),
    }
  } catch (error) {
    console.error('DDG Lite search failed:', error)
    return {
      query,
      results: [],
    }
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

export async function search(query: string): Promise<SearchResponse> {
  const response = await searchWithDDGInstantAnswer(query)

  if (response.results.length === 0) {
    return searchWithDDGLite(query)
  }

  return response
}

export async function searchWithContext(
  query: string,
  _allowedDomains?: string[],
  _blockedDomains?: string[],
): Promise<SearchResponse> {
  return search(query)
}
