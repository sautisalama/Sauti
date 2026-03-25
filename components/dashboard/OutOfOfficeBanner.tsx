'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  ArrowRight, 
  Briefcase, 
  Clock,
  X
} from 'lucide-react';
import { toggleOutOfOffice, getOutOfOfficeStatus } from '@/app/actions/availability';
import { createClient } from '@/utils/supabase/client';

interface OutOfOfficeBannerProps {
  userId: string;
  variant?: 'full' | 'compact';
  className?: string;
}

export function OutOfOfficeBanner({ userId, variant = 'full', className = '' }: OutOfOfficeBannerProps) {
  const [isOutOfOffice, setIsOutOfOffice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [inactiveServicesCount, setInactiveServicesCount] = useState(0);
  
  const supabase = createClient();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Get out of office status
        const { data: profile } = await supabase
          .from('profiles')
          .select('out_of_office')
          .eq('id', userId)
          .single();
        
        if (profile) {
          setIsOutOfOffice(profile.out_of_office || false);
        }

        // Get count of inactive services
        if (profile?.out_of_office) {
          const { count } = await supabase
            .from('support_services')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_active', false);
          
          setInactiveServicesCount(count || 0);
        }
      } catch (error) {
        console.error('Failed to fetch OOO status:', error);
      }
    };

    fetchStatus();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`profile-ooo-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          setIsOutOfOffice(payload.new.out_of_office || false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await toggleOutOfOffice(!isOutOfOffice);
      setIsOutOfOffice(!isOutOfOffice);
    } catch (error) {
      console.error('Failed to toggle OOO:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOutOfOffice || dismissed) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2 text-amber-800">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Out of Office Mode Active</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
          onClick={handleToggle}
          disabled={loading}
        >
          Turn Off
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-orange-400/10" />
      
      {/* Animated Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '24px 24px',
            color: '#f59e0b'
          }}
        />
      </div>
      
      <div className="relative p-5 flex items-center gap-4">
        {/* Icon */}
        <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-amber-900">Out of Office Mode</h3>
            <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-bold rounded-full">
              ACTIVE
            </span>
          </div>
          <p className="text-sm text-amber-700 leading-relaxed">
            Your services are currently inactive and you won't receive new case matches.
            {inactiveServicesCount > 0 && (
              <span className="font-medium"> {inactiveServicesCount} service{inactiveServicesCount !== 1 ? 's' : ''} paused.</span>
            )}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            className="h-10 px-4 border-amber-300 bg-white/80 text-amber-700 hover:bg-amber-50 hover:text-amber-900 rounded-xl font-medium"
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              <Clock className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Briefcase className="h-4 w-4 mr-2" />
            )}
            Return to Work
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small indicator for nav/sidebar use
 */
export function OutOfOfficeIndicator({ userId }: { userId: string }) {
  const [isOutOfOffice, setIsOutOfOffice] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('out_of_office')
        .eq('id', userId)
        .single();
      
      setIsOutOfOffice(data?.out_of_office || false);
    };
    fetchStatus();
  }, [userId]);

  if (!isOutOfOffice) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
      <Clock className="h-3 w-3" />
      OOO
    </div>
  );
}
