import ReportAbuseInlineForm from "@/components/ReportAbuseInlineForm";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Report Abuse | Sauti Salama",
  description: "Securely and anonymously report gender-based violence or abuse. Your information is encrypted and handled with care.",
};

export default function ReportAbusePage() {
  return (
    <main className="min-h-screen bg-white">
      <Nav />
      <div className="w-full px-4 md:px-8 lg:px-12 py-6 md:py-12">
        <div className="mb-8 md:mb-12 text-center">
          <h1 className="text-3xl md:text-6xl font-black text-sauti-blue mb-4">Report Abuse</h1>
          <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your safety is our priority. This platform is secure, encrypted, and allows for anonymous reporting.
          </p>
        </div>
        <div className="w-full max-w-5xl mx-auto">
          <ReportAbuseInlineForm />
        </div>
      </div>
      <Footer />
    </main>
  );
}
