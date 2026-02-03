import { createClient } from '@/utils/supabase/server';
import { EnhancedPublicScheduler } from '../../_components/EnhancedPublicScheduler';
import { notFound } from 'next/navigation';

interface SchedulePageProps {
  params: Promise<{
    professional: string;
  }>;
}

export default async function ProfessionalSchedulePage({ params }: SchedulePageProps) {
  const { professional } = await params;
  const supabase = await createClient();
  
  // Extract professional ID from the format: sauti-{professionalId} or custom link
  let professionalId = professional;
  if (professional.startsWith('sauti-')) {
    professionalId = professional.replace('sauti-', '');
  }

  // Fetch professional details
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      email,
      bio,
      profile_image_url,
      professional_title,
      cal_link,
      support_services (
        name,
        service_types,
        description
      )
    `)
    .eq('id', professionalId)
    .single();

  if (error || !profile) {
    notFound();
  }

  // Check if this is actually a professional (has support services)
  const { data: supportServices } = await supabase
    .from('support_services')
    .select('*')
    .eq('professional_id', professionalId);

  if (!supportServices || supportServices.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8">
        {/* Professional Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-[#1A3434] text-white flex items-center justify-center text-2xl font-bold">
                {profile.first_name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {profile.first_name} {profile.last_name}
              </h1>
              {profile.professional_title && (
                <p className="text-lg text-blue-600 font-medium mb-3">
                  {profile.professional_title}
                </p>
              )}
              {profile.bio && (
                <p className="text-gray-600 leading-relaxed">
                  {profile.bio}
                </p>
              )}
              
              {/* Services */}
              {supportServices && supportServices.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Specialized Services:</h3>
                  <div className="flex flex-wrap gap-2">
                    {supportServices.map((service) => (
                      <div key={service.id} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        {service.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scheduling Component */}
        <EnhancedPublicScheduler 
          professionalId={professionalId}
          professionalName={`${profile.first_name} ${profile.last_name}`}
          calLink={profile.cal_link}
        />

        {/* Trust & Safety */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Your Safety & Privacy</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🔒 Secure & Confidential</h4>
              <p>All appointments are conducted in secure, private environments with full confidentiality protection.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">✅ Verified Professional</h4>
              <p>This professional has been verified and is part of our trusted network of support providers.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🛡️ Crisis Support Available</h4>
              <p>If you're in immediate danger, please call emergency services. Crisis support is available 24/7.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">📞 Flexible Communication</h4>
              <p>Choose from video calls, phone calls, or secure messaging based on your comfort level.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-6 text-gray-500">
          <p className="text-sm">
            Powered by <span className="font-medium text-[#1A3434]">Sauti</span> - Supporting survivors with professional care
          </p>
        </div>
      </div>
    </div>
  );
}
