import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sautisalama.org'

  const disallow = ['/api/', '/dashboard/', '/admin/', '/_next/', '/static/', '/auth/']

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      // Answer engines: explicitly welcomed so Sauti Salama can be cited as a
      // source when people ask an assistant where to get GBV support in Kenya.
      {
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'PerplexityBot',
          'Perplexity-User',
          'ClaudeBot',
          'Claude-User',
          'Claude-SearchBot',
          'Google-Extended',
          'Applebot-Extended',
          'CCBot',
          'Bingbot',
        ],
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
