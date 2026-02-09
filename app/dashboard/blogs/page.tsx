'use client';

import { SereneBreadcrumb } from '@/components/ui/SereneBreadcrumb';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Bell, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BlogsComingSoon() {
  return (
    <div className="min-h-[80vh] flex flex-col">
      <div className="max-w-6xl mx-auto px-4 py-6 w-full">
        <SereneBreadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Blogs' }
        ]} />
      </div>

      {/* Coming Soon Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          {/* Icon */}
          <div className="relative mx-auto mb-8">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-sauti-teal/10 to-serene-blue-100 flex items-center justify-center shadow-lg">
              <FileText className="h-12 w-12 text-sauti-teal" />
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md animate-pulse">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-sauti-dark mb-4 tracking-tight">
            Blog Feature Coming Soon
          </h1>

          {/* Description */}
          <p className="text-serene-neutral-500 text-lg mb-8 leading-relaxed">
            We're working hard to bring you an amazing blogging experience. 
            Soon you'll be able to share your knowledge, insights, and resources 
            with the Sauti Salama community.
          </p>

          {/* Features Preview */}
          <div className="bg-white rounded-2xl border border-serene-neutral-200 p-6 mb-8 text-left shadow-sm">
            <h3 className="font-semibold text-sauti-dark mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sauti-teal" />
              What's Coming
            </h3>
            <ul className="space-y-3 text-sm text-serene-neutral-600">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-sauti-teal mt-2 shrink-0" />
                <span>Rich text editor with image support</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-sauti-teal mt-2 shrink-0" />
                <span>Share educational resources and case studies</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-sauti-teal mt-2 shrink-0" />
                <span>Community engagement and discussion</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-sauti-teal mt-2 shrink-0" />
                <span>NGO review and publishing workflow</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild variant="outline" className="rounded-xl border-serene-neutral-200 hover:bg-serene-neutral-50">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <Button 
              disabled
              className="bg-sauti-teal/50 text-white rounded-xl cursor-not-allowed"
            >
              <Bell className="h-4 w-4 mr-2" />
              Get Notified (Soon)
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-serene-neutral-400 mt-8">
            Expected launch: Q2 2026
          </p>
        </div>
      </div>
    </div>
  );
}
