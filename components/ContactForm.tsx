"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactForm({ title = "Get in Touch", description = "Fill out the form below and our team will get back to you shortly." }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="p-12 text-center bg-white">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-3xl font-bold text-sauti-blue mb-4">Message Sent!</h3>
        <p className="text-gray-600 text-lg">Thank you for reaching out. We will get back to you as soon as possible.</p>
        <Button 
          variant="outline" 
          className="mt-8 rounded-full px-8 h-12"
          onClick={() => setSubmitted(false)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 bg-white">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-sauti-blue mb-4">{title}</h2>
        <p className="text-gray-500 font-medium">{description}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider ml-1">Your Name</label>
          <Input 
            required 
            placeholder="Jane Doe" 
            className="rounded-2xl h-14 border-2 border-gray-100 focus:border-sauti-blue/20 focus:ring-0 text-lg"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider ml-1">Email Address</label>
          <Input 
            required 
            type="email" 
            placeholder="jane@example.com" 
            className="rounded-2xl h-14 border-2 border-gray-100 focus:border-sauti-blue/20 focus:ring-0 text-lg"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider ml-1">How can we help / What's your suggestion?</label>
          <Textarea 
            required 
            placeholder="Tell us more..." 
            className="rounded-2xl min-h-[150px] border-2 border-gray-100 focus:border-sauti-blue/20 focus:ring-0 text-lg p-6"
          />
        </div>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full h-16 rounded-2xl bg-sauti-blue text-white text-xl font-bold shadow-xl hover:bg-sauti-blue/90 transition-all"
        >
          {isSubmitting ? "Sending..." : "Send Message"}
        </Button>
      </form>
    </div>
  );
}
