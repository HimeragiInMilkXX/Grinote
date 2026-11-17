import { tool } from 'ai';
import { z } from 'zod';

export const webSearch = tool({
  description: 'Search the web for up-to-date information.',
  inputSchema: z.object({
    query: z.string().describe('The search query to execute.'),
  }),
  execute: async ({ query }) => {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 5,
      }),
    });

    if (!response.ok) throw new Error(`Tavily failed: ${response.statusText}`);
    const data = await response.json();

    return {
      results: data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      })),
    };
  },
});
