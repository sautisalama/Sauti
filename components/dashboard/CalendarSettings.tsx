'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, format, startOfDay } from 'date-fns';
import { CalendarOff, Check, Copy, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/utils/supabase/client';
import { addAvailabilityBlock, addRecurringBlock, getAvailabilityBlocks, removeAvailabilityBlock, toggleOutOfOffice } from '@/app/actions/availability';
import type { AvailabilityBlock } from '@/types/chat';

const card = 'rounded-2xl border border-serene-neutral-100 bg-white p-5 shadow-sm sm:p-6';
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function at(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Provider tools: out of office, blocking time, and the public booking link. */
export function CalendarSettings() {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [outOfOffice, setOutOfOffice] = useState(false);
  const [publicBooking, setPublicBooking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [date, setDate] = useState<Date | undefined>(startOfDay(new Date()));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [reason, setReason] = useState('Busy');
  const [repeat, setRepeat] = useState<'none' | '4' | '12'>('none');

  const load = useCallback(async (uid: string) => {
    const from = startOfDay(new Date());
    const data = await getAvailabilityBlocks(uid, from, addDays(from, 120));
    setBlocks(data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('out_of_office, is_public_booking, isVerified').eq('id', user.id).single();
      setOutOfOffice(!!data?.out_of_office);
      setPublicBooking(!!data?.is_public_booking);
      setVerified(!!data?.isVerified);
      try { await load(user.id); } catch { /* shown as empty */ }
      setLoading(false);
    })();
  }, [supabase, load]);

  async function toggleOoo(checked: boolean) {
    setOutOfOffice(checked);
    try { await toggleOutOfOffice(checked); toast({ title: checked ? 'You are out of office' : 'You are back in office', description: checked ? 'You will not be offered new cases or bookings.' : 'You can receive new cases and bookings again.' }); }
    catch { setOutOfOffice(!checked); toast({ title: 'Could not update', variant: 'destructive' }); }
  }

  async function togglePublic(checked: boolean) {
    if (!userId) return;
    setPublicBooking(checked);
    const { error } = await supabase.from('profiles').update({ is_public_booking: checked }).eq('id', userId);
    if (error) { setPublicBooking(!checked); toast({ title: 'Could not update', variant: 'destructive' }); }
  }

  async function addBlock() {
    if (!date) return;
    const s = at(date, start), e = at(date, end);
    if (e <= s) return toast({ title: 'End time must be after start time', variant: 'destructive' });
    setSaving(true);
    try {
      if (repeat === 'none') await addAvailabilityBlock(s, e, reason);
      else await addRecurringBlock(s, e, reason, `WEEKLY:${DAYS[date.getDay()]}`, addWeeks(date, Number(repeat)));
      if (userId) await load(userId);
      setDialog(false);
      toast({ title: 'Time blocked', description: 'Nobody can book you during this time.' });
    } catch {
      toast({ title: 'Could not block this time', variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    const before = blocks;
    setBlocks((b) => b.filter((x) => x.id !== id));
    try { await removeAvailabilityBlock(id); } catch { setBlocks(before); toast({ title: 'Could not remove', variant: 'destructive' }); }
  }

  const link = typeof window !== 'undefined' && userId ? `${window.location.origin}/schedule/${userId}` : '';
  const grouped = useMemo(() => {
    const m = new Map<string, AvailabilityBlock[]>();
    for (const b of blocks) {
      const k = format(new Date(b.start_time), 'yyyy-MM-dd');
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [blocks]);

  return (
    <div className="space-y-5">
      <section className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-serene-neutral-900">Out of office</h2>
            <p className="mt-1 text-sm text-serene-neutral-600">While this is on you are not offered new cases and your booking page does not accept requests. Cases you already have are not affected.</p>
          </div>
          <Switch checked={outOfOffice} onCheckedChange={toggleOoo} aria-label="Out of office" />
        </div>
      </section>

      <section className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-serene-neutral-900"><Link2 className="size-4 text-sauti-teal" /> Public booking page</h2>
            <p className="mt-1 text-sm text-serene-neutral-600">{verified ? 'Let people request an appointment with you. They see your name, title and services, never your email or phone.' : 'Available once an admin has verified you.'}</p>
          </div>
          <Switch checked={publicBooking} onCheckedChange={togglePublic} disabled={!verified} aria-label="Public booking" />
        </div>
        {publicBooking && verified && link && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-serene-neutral-50 p-2 pl-3">
            <code className="min-w-0 flex-1 truncate bg-transparent text-xs text-serene-neutral-700">{link}</code>
            <Button size="sm" variant="ghost" className="h-8 shrink-0 rounded-lg" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <><Check className="mr-1 size-3.5" /> Copied</> : <><Copy className="mr-1 size-3.5" /> Copy</>}
            </Button>
          </div>
        )}
      </section>

      <section className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-serene-neutral-900">Blocked time</h2>
            <p className="mt-1 text-sm text-serene-neutral-600">Times when you cannot be booked. Only you can see the reason.</p>
          </div>
          <Button size="sm" className="shrink-0 rounded-xl bg-sauti-teal text-white transition-[transform,background-color] duration-150 ease-out hover:bg-sauti-dark active:scale-95" onClick={() => setDialog(true)}>
            <Plus className="mr-1.5 size-4" /> Block time
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-serene-neutral-100" />)}</div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl bg-serene-neutral-50 px-4 py-8 text-center">
              <CalendarOff className="size-6 text-serene-neutral-400" />
              <p className="mt-2 text-sm font-medium text-serene-neutral-700">No blocked time</p>
              <p className="text-xs text-serene-neutral-500">You can be booked on weekdays between 09:00 and 17:00.</p>
            </div>
          ) : (
            grouped.map(([day, list]) => (
              <div key={day}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">{format(new Date(`${day}T12:00:00`), 'EEEE, d MMMM')}</h3>
                <ul className="space-y-1.5">
                  {list.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-serene-neutral-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-serene-neutral-900">{format(new Date(b.start_time), 'HH:mm')} to {format(new Date(b.end_time), 'HH:mm')}</p>
                        {b.reason && <p className="truncate text-xs text-serene-neutral-500">{b.reason}</p>}
                      </div>
                      <Button size="icon" variant="ghost" className="size-8 shrink-0 rounded-lg text-serene-neutral-400 transition-[color,background-color,transform] duration-150 ease-out hover:bg-sauti-red-light hover:text-sauti-red active:scale-95" onClick={() => remove(b.id)} aria-label="Remove blocked time">
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Block time</DialogTitle>
            <DialogDescription>People will not be able to book you during this time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl bg-serene-neutral-50 p-2">
              <Calendar mode="single" selected={date} onSelect={setDate} startMonth={startOfDay(new Date())} disabled={{ before: startOfDay(new Date()) }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={start} onValueChange={setStart}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={end} onValueChange={setEnd}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Busy', 'Meeting', 'Training', 'Personal', 'Leave'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5">
                <Label>Repeat</Label>
                <Select value={repeat} onValueChange={(v) => setRepeat(v as typeof repeat)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Does not repeat</SelectItem><SelectItem value="4">Weekly for 4 weeks</SelectItem><SelectItem value="12">Weekly for 12 weeks</SelectItem></SelectContent></Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={addBlock} disabled={saving || !date} className="bg-sauti-teal text-white hover:bg-sauti-dark">{saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving…</> : 'Block this time'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
