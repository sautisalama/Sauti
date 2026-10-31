import ReportAbuseInlineForm from "@/components/ReportAbuseInlineForm";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Phone, ShieldCheck } from "lucide-react";

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
        <div className="w-full max-w-5xl mx-auto mb-6 grid gap-3 md:grid-cols-2">
          <a
            href="tel:1195"
            className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 hover:bg-red-100"
          >
            <Phone className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-sm">
              <strong className="block text-base">In danger right now? Call 1195</strong>
              National GBV hotline. Tap to call.
            </span>
          </a>
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm">
              <strong className="block text-base">Need to leave quickly?</strong>
              Press <em>Exit this page</em> or tap Shift three times. It does not clear your browser history, so
              clear it too if someone checks your device.
            </p>
          </div>
        </div>
        <div className="w-full max-w-5xl mx-auto">
          <ReportAbuseInlineForm />
        </div>
      </div>
      <Footer />
    </main>
  );
}
