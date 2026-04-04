'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { TimeSlot, AvailabilityBlock } from '@/types/chat'

export async function toggleOutOfOffice(isOutOfOffice: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) throw new Error('Unauthorized')
    
    // The database trigger handles service deactivation automatically
    const { error } = await supabase
        .from('profiles')
        .update({ out_of_office: isOutOfOffice })
        .eq('id', user.id)
        
    if (error) throw new Error('Failed to update status')
    
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/settings')
    return { success: true }
}

export async function getOutOfOfficeStatus(userId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const targetUserId = userId || user?.id
    if (!targetUserId) throw new Error('Unauthorized')
    
    const { data, error } = await supabase
        .from('profiles')
        .select('out_of_office')
        .eq('id', targetUserId)
        .single()
    
    if (error) throw new Error('Failed to get status')
    
    return data?.out_of_office || false
}

export async function addAvailabilityBlock(
    startTime: Date, 
    endTime: Date, 
    reason?: string,
    isRecurring?: boolean,
    recurrenceRule?: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('availability_blocks')
        .insert({
            user_id: user.id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            reason,
            is_recurring: isRecurring || false,
            recurrence_rule: recurrenceRule
        })
        .select()
        .single()
    
    if (error) throw new Error('Failed to add block')
    
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/profile')
    return data as AvailabilityBlock
}

export async function removeAvailabilityBlock(blockId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('availability_blocks')
        .delete()
        .eq('id', blockId)
        .eq('user_id', user.id)
        
    if (error) throw new Error('Failed to remove block')
    
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/profile')
    return { success: true }
}

export async function getAvailabilityBlocks(userId: string, start: Date, end: Date): Promise<AvailabilityBlock[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('user_id', userId)
        .gte('end_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true })
        
    if (error) throw new Error('Failed to fetch availability')
    
    return (data || []) as AvailabilityBlock[]
}

/**
 * Check if a specific time slot is available for a user
 * Checks against both availability blocks and existing appointments
 */
export async function checkTimeSlotAvailability(
    userId: string,
    startTime: Date,
    endTime: Date
): Promise<boolean> {
    const supabase = await createClient()
    
    // Check availability blocks
    const { data: blocks } = await supabase
        .from('availability_blocks')
        .select('id')
        .eq('user_id', userId)
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString())
        .limit(1)
    
    if (blocks && blocks.length > 0) {
        return false // Has blocking time
    }
    
    // Check appointments
    const { data: appointments } = await supabase
        .from('appointments')
        .select('appointment_id')
        .or(`professional_id.eq.${userId},survivor_id.eq.${userId}`)
        .in('status', ['pending', 'confirmed'])
        .lt('appointment_date', endTime.toISOString())
        .limit(1)
    
    // Note: This is a simplified check. A more accurate version would
    // also check the end time of appointments based on duration_minutes
    
    if (appointments && appointments.length > 0) {
        return false // Has existing appointment
    }
    
    return true
}

/**
 * Get available time slots for a user on a specific date
 * Returns slots that don't conflict with blocks or appointments
 */
export async function getAvailableSlotsForDate(
    userId: string,
    date: Date,
    slotDurationMinutes: number = 60
): Promise<TimeSlot[]> {
    const supabase = await createClient()
    
    // Set working hours (8 AM to 6 PM)
    const dayStart = new Date(date)
    dayStart.setHours(8, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(18, 0, 0, 0)
    
    // Get all blocks for this day
    const { data: blocks } = await supabase
        .from('availability_blocks')
        .select('start_time, end_time')
        .eq('user_id', userId)
        .gte('end_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
    
    // Get all appointments for this day
    const { data: appointments } = await supabase
        .from('appointments')
        .select('appointment_date, duration_minutes')
        .or(`professional_id.eq.${userId},survivor_id.eq.${userId}`)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', dayStart.toISOString())
        .lte('appointment_date', dayEnd.toISOString())
    
    // Combine busy times
    const busyTimes: { start: Date; end: Date }[] = []
    
    blocks?.forEach(block => {
        busyTimes.push({
            start: new Date(block.start_time),
            end: new Date(block.end_time)
        })
    })
    
    appointments?.forEach(apt => {
        if (!apt.appointment_date) return
        const start = new Date(apt.appointment_date)
        const end = new Date(start.getTime() + (Number(apt.duration_minutes) || 60) * 60000)
        busyTimes.push({ start, end })
    })
    
    // Generate available slots
    const availableSlots: TimeSlot[] = []
    let currentSlot = new Date(dayStart)
    
    while (currentSlot.getTime() + slotDurationMinutes * 60000 <= dayEnd.getTime()) {
        const slotEnd = new Date(currentSlot.getTime() + slotDurationMinutes * 60000)
        
        // Check if this slot overlaps with any busy time
        const isBlocked = busyTimes.some(busy => 
            (currentSlot >= busy.start && currentSlot < busy.end) ||
            (slotEnd > busy.start && slotEnd <= busy.end) ||
            (currentSlot <= busy.start && slotEnd >= busy.end)
        )
        
        // Also check if slot is in the past
        const isInPast = currentSlot < new Date()
        
        if (!isBlocked && !isInPast) {
            availableSlots.push({
                slot_start: currentSlot.toISOString(),
                slot_end: slotEnd.toISOString()
            })
        }
        
        // Move to next slot
        currentSlot = new Date(currentSlot.getTime() + slotDurationMinutes * 60000)
    }
    
    return availableSlots
}

/**
 * Get availability summary for a date range
 * Returns dates that have available slots
 */
export async function getAvailabilityCalendar(
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<{ date: string; hasSlots: boolean; slotCount: number }[]> {
    const result: { date: string; hasSlots: boolean; slotCount: number }[] = []
    
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
        const slots = await getAvailableSlotsForDate(userId, currentDate)
        result.push({
            date: currentDate.toISOString().split('T')[0],
            hasSlots: slots.length > 0,
            slotCount: slots.length
        })
        currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return result
}

/**
 * Bulk add availability blocks (e.g., for recurring events)
 */
export async function addRecurringBlock(
    startTime: Date,
    endTime: Date,
    reason: string,
    recurrenceRule: string, // e.g., "WEEKLY:MON,WED,FRI" or "DAILY"
    untilDate: Date
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) throw new Error('Unauthorized')
    
    // Parse recurrence rule and generate blocks
    const blocks: { user_id: string; start_time: string; end_time: string; reason: string; is_recurring: boolean; recurrence_rule: string }[] = []
    
    const [type, daysStr] = recurrenceRule.split(':')
    const days = daysStr ? daysStr.split(',') : []
    const dayMap: Record<string, number> = { 'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6 }
    
    let currentDate = new Date(startTime)
    
    while (currentDate <= untilDate) {
        let shouldAdd = false
        
        if (type === 'DAILY') {
            shouldAdd = true
        } else if (type === 'WEEKLY') {
            const currentDay = currentDate.getDay()
            shouldAdd = days.some(d => dayMap[d] === currentDay)
        }
        
        if (shouldAdd) {
            const blockStart = new Date(currentDate)
            blockStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0)
            
            const blockEnd = new Date(currentDate)
            blockEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0)
            
            blocks.push({
                user_id: user.id,
                start_time: blockStart.toISOString(),
                end_time: blockEnd.toISOString(),
                reason,
                is_recurring: true,
                recurrence_rule: recurrenceRule
            })
        }
        
        currentDate.setDate(currentDate.getDate() + 1)
    }
    
    if (blocks.length > 0) {
        const { error } = await supabase
            .from('availability_blocks')
            .insert(blocks)
        
        if (error) throw new Error('Failed to add recurring blocks')
    }
    
    revalidatePath('/dashboard/calendar')
    return { success: true, blocksCreated: blocks.length }
}
