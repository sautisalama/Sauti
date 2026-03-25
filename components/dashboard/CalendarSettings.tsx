'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toggleOutOfOffice, addAvailabilityBlock, removeAvailabilityBlock, getAvailabilityBlocks } from '@/app/actions/availability';
import { Calendar } from '@/components/ui/calendar';
import { createClient } from '@/utils/supabase/client';
import { Trash2, Plus, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function CalendarSettings() {
  const [isOutOfOffice, setIsOutOfOffice] = useState(false);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [reason, setReason] = useState('Busy');
  const [isAdding, setIsAdding] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    // Fetch initial status
    const fetchStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('out_of_office').eq('id', user.id).single();
            if (data) setIsOutOfOffice(data.out_of_office || false);
            
            // Fetch blocks for this month
            const start = new Date();
            start.setDate(1);
            const end = new Date();
            end.setMonth(end.getMonth() + 1);
            const blocksData = await getAvailabilityBlocks(user.id, start, end);
            setBlocks(blocksData || []);
        }
    };
    fetchStatus();
  }, []);

  const handleToggleOOO = async (checked: boolean) => {
      setIsOutOfOffice(checked);
      await toggleOutOfOffice(checked);
  };

  const handleAddBlock = async () => {
      if (!selectedDate) return;
      
      const start = new Date(selectedDate);
      const [sh, sm] = startTime.split(':').map(Number);
      start.setHours(sh, sm);
      
      const end = new Date(selectedDate);
      const [eh, em] = endTime.split(':').map(Number);
      end.setHours(eh, em);
      
      await addAvailabilityBlock(start, end, reason);
      
      // Refresh blocks
      const { data: { user } } = await supabase.auth.getUser();
      if(user) {
         const s = new Date(); s.setDate(1);
         const e = new Date(); e.setMonth(e.getMonth() + 1);
         const blocksData = await getAvailabilityBlocks(user.id, s, e);
         setBlocks(blocksData || []);
      }
      setIsAdding(false);
  };

  const handleDeleteBlock = async (id: string) => {
      await removeAvailabilityBlock(id);
      setBlocks(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Out of Office Toggle */}
      <Card className="border-amber-100 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-amber-900 flex items-center justify-between">
             Out of Office Mode
             <Switch checked={isOutOfOffice} onCheckedChange={handleToggleOOO} />
          </CardTitle>
          <CardDescription className="text-amber-700/80">
            Scanning active services will ignore your profile while this is enabled.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Availability Blocking */}
      <div className="grid md:grid-cols-2 gap-6">
         <Card>
            <CardHeader>
                <CardTitle>Block Availability</CardTitle>
                <CardDescription>Select dates you are unavailable.</CardDescription>
            </CardHeader>
            <CardContent>
                <Calendar 
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border shadow-sm mx-auto"
                />
            </CardContent>
         </Card>

         <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                   <CardTitle>Blocked Slots</CardTitle>
                   <CardDescription>
                      {selectedDate?.toLocaleDateString()}
                   </CardDescription>
                </div>
                <Dialog open={isAdding} onOpenChange={setIsAdding}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2"/> Add Block</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Blocked Time</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time</Label>
                                    <Select value={startTime} onValueChange={setStartTime}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Array.from({length: 24}).map((_, i) => (
                                                <SelectItem key={i} value={`${i.toString().padStart(2,'0')}:00`}>{`${i.toString().padStart(2,'0')}:00`}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time</Label>
                                    <Select value={endTime} onValueChange={setEndTime}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Array.from({length: 24}).map((_, i) => (
                                                <SelectItem key={i} value={`${i.toString().padStart(2,'0')}:00`}>{`${i.toString().padStart(2,'0')}:00`}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Reason</Label>
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Busy">Busy</SelectItem>
                                        <SelectItem value="Meeting">Meeting</SelectItem>
                                        <SelectItem value="Personal">Personal</SelectItem>
                                        <SelectItem value="Lunch">Lunch</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAddBlock}>Confirm Block</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
               {blocks
                  .filter(b => new Date(b.start_time).toDateString() === selectedDate?.toDateString())
                  .map(block => (
                   <div key={block.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                       <div className="flex items-center gap-3">
                           <Clock className="w-4 h-4 text-slate-400"/>
                           <div className="text-sm">
                               <div className="font-medium text-slate-900">
                                   {new Date(block.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(block.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </div>
                               <div className="text-slate-500 text-xs">{block.reason}</div>
                           </div>
                       </div>
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteBlock(block.id)}>
                           <Trash2 className="w-4 h-4" />
                       </Button>
                   </div>
               ))}
               {blocks.filter(b => new Date(b.start_time).toDateString() === selectedDate?.toDateString()).length === 0 && (
                   <div className="text-center py-8 text-slate-400 text-sm">
                       No blocked times for this date.
                   </div>
               )}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
