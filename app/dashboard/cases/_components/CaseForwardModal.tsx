'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightCircle, Check, Search, Loader2, FileText, MessageSquare, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Professional {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  professional_title: string | null;
  user_type: string;
}

interface SupportService {
  id: string;
  name: string;
  service_types: string;
}

interface CaseForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  matchDate: string;
  survivorName?: string;
  currentProfessionalId: string;
  supportHistory?: { service: string; date: string; status: string }[];
  onCaseForwarded?: () => void;
}

export function CaseForwardModal({
  isOpen,
  onClose,
  matchId,
  matchDate,
  survivorName = 'Survivor',
  currentProfessionalId,
  supportHistory = [],
  onCaseForwarded
}: CaseForwardModalProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<SupportService[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'details' | 'confirm'>('select');

  const supabase = createClient();

  // Load professionals and services
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load verified professionals
        const { data: profsData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, professional_title, user_type')
          .in('user_type', ['professional', 'ngo'])
          .neq('id', currentProfessionalId)
          .limit(50);

        if (profsData) {
          setProfessionals(profsData);
        }

        // Load available services
        const { data: servicesData } = await supabase
          .from('support_services')
          .select('id, name, service_types')
          .neq('user_id', currentProfessionalId)
          .limit(50);

        if (servicesData) {
          setServices(servicesData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, currentProfessionalId]);

  // Filter professionals based on search
  const filteredProfessionals = professionals.filter(p => {
    const name = `${p.first_name || ''} ${p.last_name || ''} ${p.professional_title || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // Get selected professional details
  const selectedProf = professionals.find(p => p.id === selectedProfessional);

  const handleSubmit = async () => {
    if (!selectedProfessional && !selectedService) {
      setError('Please select a professional or service');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('case_shares')
        .insert({
          match_id: matchId,
          from_professional_id: currentProfessionalId,
          to_professional_id: selectedProfessional,
          to_service_pool: !selectedProfessional && !!selectedService,
          include_notes: includeNotes,
          include_recommendations: includeRecommendations,
          required_services: selectedService ? [selectedService] : null,
          reason: reason.trim() || null,
          original_match_date: matchDate,
          support_history: supportHistory.length > 0 ? supportHistory : null,
          status: 'pending'
        });

      if (insertError) throw insertError;

      // TODO: Send notification to receiving professional

      onCaseForwarded?.();
      handleClose();
    } catch (err: any) {
      console.error('Error forwarding case:', err);
      setError(err.message || 'Failed to forward case');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedProfessional(null);
    setSelectedService(null);
    setIncludeNotes(true);
    setIncludeRecommendations(true);
    setReason('');
    setSearchQuery('');
    setStep('select');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightCircle className="h-5 w-5 text-serene-blue-500" />
            Forward Case
          </DialogTitle>
          <DialogDescription>
            Share this case with another service provider
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400" />
              <input
                type="text"
                placeholder="Search professionals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-serene-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-serene-blue-200"
              />
            </div>

            {/* Professionals List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" />
                </div>
              ) : filteredProfessionals.length === 0 ? (
                <div className="text-center py-8 text-serene-neutral-400 text-sm">
                  No professionals found
                </div>
              ) : (
                filteredProfessionals.map(prof => (
                  <button
                    key={prof.id}
                    onClick={() => {
                      setSelectedProfessional(prof.id);
                      setStep('details');
                    }}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                      ${selectedProfessional === prof.id 
                        ? 'border-serene-blue-500 bg-serene-blue-50' 
                        : 'border-serene-neutral-200 hover:border-serene-blue-300 hover:bg-serene-neutral-50'
                      }
                    `}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={prof.avatar_url || undefined} />
                      <AvatarFallback className="bg-serene-blue-100 text-serene-blue-700">
                        {prof.first_name?.charAt(0) || 'P'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-serene-neutral-900 truncate">
                        {prof.first_name} {prof.last_name}
                      </p>
                      <p className="text-xs text-serene-neutral-500 truncate">
                        {prof.professional_title || prof.user_type}
                      </p>
                    </div>
                    <ArrowRightCircle className="h-5 w-5 text-serene-neutral-300" />
                  </button>
                ))
              )}
            </div>

            {/* Or select by service type */}
            <div className="pt-4 border-t border-serene-neutral-100">
              <p className="text-sm text-serene-neutral-500 mb-2">Or forward to a service pool:</p>
              <Select
                value={selectedService || ''}
                onValueChange={(value) => {
                  setSelectedService(value);
                  setSelectedProfessional(null);
                  setStep('details');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map(svc => (
                    <SelectItem key={svc.id} value={svc.id}>
                      {svc.name} ({svc.service_types})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-5">
            {/* Selected recipient */}
            {selectedProf && (
              <div className="flex items-center gap-3 p-3 bg-serene-blue-50 rounded-xl">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedProf.avatar_url || undefined} />
                  <AvatarFallback className="bg-serene-blue-100 text-serene-blue-700">
                    {selectedProf.first_name?.charAt(0) || 'P'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-serene-neutral-900">
                    {selectedProf.first_name} {selectedProf.last_name}
                  </p>
                  <p className="text-xs text-serene-neutral-500">
                    {selectedProf.professional_title}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setStep('select')}
                >
                  Change
                </Button>
              </div>
            )}

            {/* Case metadata */}
            <div className="bg-serene-neutral-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-serene-neutral-400" />
                <span className="text-serene-neutral-600">Original match:</span>
                <span className="font-medium">{format(new Date(matchDate), 'MMM d, yyyy')}</span>
              </div>
              {supportHistory.length > 0 && (
                <div className="text-sm text-serene-neutral-600">
                  {supportHistory.length} previous support interactions will be included
                </div>
              )}
            </div>

            {/* Sharing options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-serene-neutral-200">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-serene-neutral-500" />
                  <span className="text-sm font-medium">Include case notes</span>
                </div>
                <Switch
                  checked={includeNotes}
                  onCheckedChange={setIncludeNotes}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-serene-neutral-200">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-serene-neutral-500" />
                  <span className="text-sm font-medium">Include recommendations</span>
                </div>
                <Switch
                  checked={includeRecommendations}
                  onCheckedChange={setIncludeRecommendations}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason for forwarding (optional)</Label>
              <Textarea
                placeholder="Why are you forwarding this case?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep('select')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-serene-blue-500 hover:bg-serene-blue-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Forwarding...
                  </>
                ) : (
                  <>
                    <ArrowRightCircle className="h-4 w-4 mr-2" />
                    Forward Case
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
