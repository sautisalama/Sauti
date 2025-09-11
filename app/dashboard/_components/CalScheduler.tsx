"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Globe, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface CalSchedulerProps {
  professionalId: string;
  calLink?: string; // Their custom Cal.com link
}

export function CalScheduler({ professionalId, calLink }: CalSchedulerProps) {
  const [isCalEmbedLoaded, setIsCalEmbedLoaded] = useState(false);

  useEffect(() => {
    // Load Cal.com embed script
    const script = document.createElement('script');
    script.src = 'https://app.cal.com/embed/embed.js';
    script.async = true;
    script.onload = () => setIsCalEmbedLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector('script[src="https://app.cal.com/embed/embed.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  // Default Cal.com link if not provided
  const defaultCalLink = `sauti-${professionalId}`;
  const embedLink = calLink || defaultCalLink;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Professional Scheduling
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Clock className="h-4 w-4 mx-auto mb-1" />
              <p className="font-medium">Available</p>
              <p className="text-gray-600">Mon-Fri</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Globe className="h-4 w-4 mx-auto mb-1" />
              <p className="font-medium">Timezone</p>
              <p className="text-gray-600">Local</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Settings className="h-4 w-4 mx-auto mb-1" />
              <p className="font-medium">Duration</p>
              <p className="text-gray-600">60 min</p>
            </div>
          </div>

          {/* Embedded Cal.com scheduler */}
          <div className="border rounded-lg overflow-hidden">
            {isCalEmbedLoaded ? (
              <div
                data-cal-link={embedLink}
                data-cal-config='{"layout":"month_view","theme":"light"}'
                style={{ width: '100%', height: '600px', overflow: 'scroll' }}
              ></div>
            ) : (
              <div className="h-96 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading scheduler...</p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Scheduling Configuration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Configure your availability, meeting types, and scheduling preferences.
                  </p>
                  <Button 
                    onClick={() => window.open(`https://cal.com/${embedLink}`, '_blank')}
                    className="w-full"
                  >
                    Open Cal.com Dashboard
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/schedule/${embedLink}`)}
              className="flex-1"
            >
              <Globe className="h-4 w-4 mr-2" />
              Share Link
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
