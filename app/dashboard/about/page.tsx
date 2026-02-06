import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-4">
        <SereneBreadcrumb items={[{ label: "About Sauti Salama", active: true }]} />
      </div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-orange-400/90 via-orange-300/80 to-orange-100/70 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-slate-800 mb-6">
              Breaking the Silence, Building a Brighter Future
            </h1>
            <p className="text-xl text-slate-700 mb-8">
              44% of Kenyan women have experienced physical or sexual violence from a partner. 
              This is millions of women living in fear, suffering immense emotional and physical harm, 
              and facing significant barriers to justice and healing.
            </p>
            <div className="flex gap-4">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                Join App Waitlist
              </Button>
              <Button size="lg" variant="outline" className="border-teal-600 text-teal-600">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Understanding the Crisis Section */}
      <section className="py-16 container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-6">
              Understanding the Crisis
            </h2>
            <p className="text-slate-600 mb-6">
              Gender-based violence (GBV) is a brutal reality in Kenya, impacting countless lives. 
              Millions of women, and a hidden population of men, carry the scars of physical, 
              emotional, and sexual abuse.
            </p>
            <p className="text-slate-600 mb-6">
              Statistics paint a grim picture: 44% of Kenyan women aged 15-49 have experienced 
              violence from a partner (2014 DHS). Men and corporate women often suffer in silence 
              due to social stigma and fear of jeopardizing their standing.
            </p>
          </div>
          <div className="bg-[#FFF8F0] p-8 rounded-lg">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">
              Our Mobile Application Features
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <h4 className="font-semibold">Automatic Anonymous Mode</h4>
                  <p className="text-slate-600">Report abuse and access resources discreetly.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h4 className="font-semibold">Full Confidentiality</h4>
                  <p className="text-slate-600">Choose to keep your details private, even while seeking support services.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h4 className="font-semibold">Optional Identification</h4>
                  <p className="text-slate-600">If you're comfortable, you can provide your details to access legal aid and personalized guidance.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Support System Section */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-slate-800 mb-12 text-center">
            Comprehensive Support System
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                icon: "🆘",
                title: "Immediate Emergency Response",
                description: "Get the help you need, right when you need it."
              },
              {
                icon: "⚕️",
                title: "Comprehensive Resources",
                description: "Find legal aid, medical care, and support services all in one place."
              },
              {
                icon: "🧠",
                title: "Mental Health Support",
                description: "Connect with qualified professionals to heal from trauma."
              },
              {
                icon: "⚖️",
                title: "Legal Guidance",
                description: "Know your rights and take steps toward justice."
              }
            ].map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <span className="text-3xl mb-4 block">{item.icon}</span>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 container mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-6">
          Sauti Salama means "Safe Voice" in Swahili
        </h2>
        <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          Sauti Salama is more than an app; it's a movement for change. By joining our waitlist, 
          you're taking a stand against GBV and becoming part of the solution. Together, we can 
          build a safer future for everyone.
        </p>
        <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
          Join App Waitlist
        </Button>
      </section>
    </div>
  );
}
