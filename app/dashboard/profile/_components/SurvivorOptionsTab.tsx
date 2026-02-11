'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  ArrowRight, 
  UserPlus, 
  Share2, 
  AlertTriangle, 
  ChevronDown, 
  Check, 
  X,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Shield
} from 'lucide-react';

interface MatchedService {
  id: string;
  status: string;
  created_at: string;
  provider?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    professional_title?: string | null;
  };
  support_service?: {
    name: string;
    service_types: string;
    phone_number?: string;
  };
}

interface SurvivorOptionsTabProps {
  userId: string;
  reportId: string;
  matchedServices?: MatchedService[];
  onRequestChange?: () => void;
}

export function SurvivorOptionsTab({ 
  userId, 
  reportId, 
  matchedServices = [],
  onRequestChange 
}: SurvivorOptionsTabProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  
  const supabase = createClient();
  const activeMatches = matchedServices.filter(m => m.status === 'active' || m.status === 'pending');

  const handleRequestChange = async () => {
    if (!changeReason.trim()) return;
    setIsSubmitting(true);
    
    try {
      // Create a support request for provider change
      const { error } = await supabase
        .from('support_requests')
        .insert({
          user_id: userId,
          report_id: reportId,
          request_type: 'provider_change',
          reason: changeReason.trim(),
          status: 'pending'
        });

      if (!error) {
        setShowChangeDialog(false);
        setChangeReason('');
        onRequestChange?.();
      }
    } catch (error) {
      console.error('Error requesting provider change:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatServiceType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-serene-neutral-900">Your Support Team</h3>
        <p className="text-sm text-serene-neutral-500">
          View your assigned providers and manage your support preferences
        </p>
      </div>

      {/* Active Matches */}
      {activeMatches.length > 0 ? (
        <div className="space-y-3">
          {activeMatches.map(match => (
            <div 
              key={match.id}
              className="bg-white rounded-xl border border-serene-neutral-200 overflow-hidden"
            >
              {/* Provider Summary */}
              <button
                onClick={() => setExpandedProvider(expandedProvider === match.id ? null : match.id)}
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-serene-neutral-50 transition-colors"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={match.provider?.avatar_url || undefined} />
                  <AvatarFallback className="bg-serene-blue-100 text-serene-blue-600">
                    {match.provider?.first_name?.charAt(0) || 'P'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-serene-neutral-900">
                    {match.provider?.first_name} {match.provider?.last_name}
                  </p>
                  {match.provider?.professional_title && (
                    <p className="text-sm text-serene-neutral-500">
                      {match.provider.professional_title}
                    </p>
                  )}
                  {match.support_service && (
                    <p className="text-xs text-serene-blue-600 mt-1">
                      {formatServiceType(match.support_service.service_types)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    match.status === 'active' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {match.status}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-serene-neutral-400 transition-transform ${
                    expandedProvider === match.id ? 'rotate-180' : ''
                  }`} />
                </div>
              </button>

              {/* Expanded Details */}
              {expandedProvider === match.id && (
                <div className="px-4 pb-4 border-t border-serene-neutral-100 bg-serene-neutral-50">
                  <div className="pt-4 space-y-3">
                    {match.support_service?.phone_number && (
                      <a 
                        href={`tel:${match.support_service.phone_number}`}
                        className="flex items-center gap-3 text-sm text-serene-neutral-600 hover:text-serene-blue-600"
                      >
                        <Phone className="h-4 w-4" />
                        {match.support_service.phone_number}
                      </a>
                    )}
                    {match.support_service?.name && (
                      <div className="flex items-center gap-3 text-sm text-serene-neutral-600">
                        <Shield className="h-4 w-4" />
                        {match.support_service.name}
                      </div>
                    )}
                    <p className="text-xs text-serene-neutral-400 pt-2">
                      Matched on {new Date(match.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-serene-neutral-50 rounded-xl">
          <p className="text-serene-neutral-500">No active providers assigned yet</p>
          <p className="text-sm text-serene-neutral-400 mt-1">
            You'll be matched with support providers soon
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {activeMatches.length > 0 && (
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => setShowChangeDialog(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Request Different Provider
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowShareDialog(true)}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share Case
          </Button>
        </div>
      )}

      {/* Request Change Dialog */}
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-serene-blue-500" />
              Request Different Provider
            </DialogTitle>
            <DialogDescription>
              Tell us why you'd like a different provider. This helps us match you better.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <textarea
              placeholder="Please share your reason (optional but helpful)..."
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-serene-neutral-200 p-3 text-sm resize-none focus:ring-2 focus:ring-serene-blue-500 focus:border-transparent"
            />
            <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
              <p className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Your current provider will be notified that you've requested a change. This is confidential.</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowChangeDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestChange}
              disabled={isSubmitting}
              className="flex-1 bg-serene-blue-500 hover:bg-serene-blue-600"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Case Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-serene-blue-500" />
              Share Your Case
            </DialogTitle>
            <DialogDescription>
              Request to have your case shared with an additional provider for specialized support.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center text-serene-neutral-500">
            <p>This feature is coming soon.</p>
            <p className="text-sm mt-2">You'll be able to request additional support from other providers.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowShareDialog(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
