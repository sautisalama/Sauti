import { MetadataRoute } from 'next'
import { PUBLICATIONS } from '@/lib/publications'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sautisalama.org'

/**
 * Priority tiers. Survivor-facing entry points rank highest because those are
 * the pages we most want surfaced for searches like "GBV support Kenya".
 */
const HIGH_PRIORITY = ['', '/report-abuse', '/contact', '/about']
const MEDIUM_PRIORITY = ['/programs', '/impact', '/learn', '/publications', '/faq', '/volunteer']

const routes = [
  '',
  '/about',
  '/contact',
  '/impact',
  '/programs',
  '/learn',
  '/publications',
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
  '/impact/health-and-care',
  '/impact/advocacy-and-justice',
  '/impact/youth-leadership',
  '/impact/capacity-building',
  '/impact/survivor-cafe',
  '/impact/platform',
  '/impact/end-femicide',
  '/impact/16-days-of-activism',
  '/impact/climate-and-care',
  '/impact/climate-justice',
  '/impact/feminist-tech',
  '/impact/cop-30',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  const pages = Array.from(new Set([...routes, ...PUBLICATIONS.map((p) => p.href)])).map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified,
      changeFrequency: (HIGH_PRIORITY.includes(route) ? 'daily' : 'weekly') as
        | 'daily'
        | 'weekly',
      priority: route === '' ? 1 : HIGH_PRIORITY.includes(route) ? 0.9 : MEDIUM_PRIORITY.includes(route) ? 0.8 : 0.6,
    })
  )

  return pages
}
