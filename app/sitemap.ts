import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sautisalama.org'
  
  const routes = [
    '',
    '/about',
    '/impact',
    '/programs',
    '/learn',
    '/volunteer',
    '/report-abuse',
    '/signin',
    '/signup',
    '/faq',
    '/data-privacy',
    '/privacy-policy',
    '/terms-conditions',
    '/learn/climate-care',
    '/programs/access-to-care',
    '/programs/prevention',
    '/programs/legal-access',
    '/programs/feminist-tech',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  return routes
}
