import { getBookableProfessional } from '@/lib/scheduling/public-professional';
import { EnhancedPublicScheduler } from '../../_components/EnhancedPublicScheduler';
import { notFound } from 'next/navigation';
import { BadgeCheck, LifeBuoy, Lock, MessageCircle } from 'lucide-react';

interface SchedulePageProps {
  params: Promise<{
    professional: string;
  }>;
}

const card = 'rounded-2xl border border-serene-neutral-100 bg-white p-5 shadow-sm sm:p-6';

export default async function ProfessionalSchedulePage({ params }: SchedulePageProps) {
  const { professional } = await params;
  // Visitors are not signed in, so this goes through the safe public lookup (verified, public-booking
  // professionals only; never email or phone).
  const bookable = await getBookableProfessional(professional);
  if (!bookable) notFound();
  const profile = bookable;
  const supportServices = bookable.services;
  const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();

  return (
    <main className="min-h-screen bg-serene-neutral-50">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-10 lg:space-y-6">
        {/* Professional header */}
        <header className={card}>
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <div className="flex size-16 items-center justify-center rounded-full bg-sauti-teal text-xl font-semibold text-white sm:size-20 sm:text-2xl">
                {profile.first_name?.[0]?.toUpperCase() || 'P'}
              </div>
              <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-white shadow-sm" title="Verified by Sauti Salama">
                <BadgeCheck className="size-5 text-serene-green-600" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-serene-neutral-900 sm:text-2xl">{fullName}</h1>
              {profile.professional_title && <p className="mt-0.5 text-sm font-medium text-sauti-teal">{profile.professional_title}</p>}
              {profile.bio && <p className="mt-2 text-sm leading-relaxed text-serene-neutral-600">{profile.bio}</p>}
              {supportServices.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Services">
                  {supportServices.map((service) => (
                    <li key={service.id} className="rounded-lg bg-serene-neutral-100 px-2.5 py-1 text-xs font-medium text-serene-neutral-700">
                      {service.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </header>

        <EnhancedPublicScheduler
          professionalId={profile.id}
          professionalName={fullName}
          calLink={profile.cal_link || undefined}
        />

        {/* Trust and safety */}
        <section className={card} aria-labelledby="safety-title">
          <h2 id="safety-title" className="text-base font-semibold text-serene-neutral-900">Your safety and privacy</h2>
          <div className="mt-4 grid gap-5 text-sm text-serene-neutral-600 sm:grid-cols-2">
            {[
              { icon: Lock, title: 'Private and confidential', text: 'Your request goes only to this provider. Your details are never shown publicly.' },
              { icon: BadgeCheck, title: 'Verified provider', text: 'Sauti Salama has checked this provider’s documents and service.' },
              { icon: LifeBuoy, title: 'In danger now?', text: 'Call 999, or the national GBV helpline on 1195 (free, 24 hours).' },
              { icon: MessageCircle, title: 'Your choice', text: 'The provider will confirm by email. You can ask for a call, video or messages.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sauti-teal/10"><Icon className="size-4 text-sauti-teal" /></span>
                <div>
                  <h3 className="font-medium text-serene-neutral-900">{title}</h3>
                  <p className="mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="py-4 text-center text-xs text-serene-neutral-500">
          Powered by <span className="font-medium text-sauti-teal">Sauti Salama</span>, supporting survivors with professional care
        </p>
      </div>
    </main>
  );
}
