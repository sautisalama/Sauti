-- Migration: Advanced Matching, Chat, and Availability Updates
-- Created: 2026-02-20

-- 1. Update match_status_type ENUM
-- Adding new states for the 2-step matching process and rescheduling
DO $$
BEGIN
    ALTER TYPE "public"."match_status_type" ADD VALUE IF NOT EXISTS 'proposed';
    ALTER TYPE "public"."match_status_type" ADD VALUE IF NOT EXISTS 'pending_survivor';
    ALTER TYPE "public"."match_status_type" ADD VALUE IF NOT EXISTS 'reschedule_requested';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update messages table for Chat Features
-- Adding support for granular reactions and read receipts
ALTER TABLE "public"."messages" 
ADD COLUMN IF NOT EXISTS "reactions" jsonb DEFAULT '{}'::jsonb, -- Structure: { "user_id": "emoji_char" }
ADD COLUMN IF NOT EXISTS "read_by" jsonb DEFAULT '[]'::jsonb;   -- Structure: [{ "user_id": "...", "read_at": "..." }]

-- 3. Update profiles table for Availability
-- Simple toggle for Out of Office
ALTER TABLE "public"."profiles"
ADD COLUMN IF NOT EXISTS "out_of_office" boolean DEFAULT false;

-- 4. Create availability_blocks table
-- For granular time blocking by Professionals and Survivors
CREATE TABLE IF NOT EXISTS "public"."availability_blocks" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "reason" text, -- e.g., "Personal", "Meeting", "Lunch"
    "is_recurring" boolean DEFAULT false,
    "recurrence_rule" text, -- simple string for now, e.g., 'WEEKLY:MON,WED' (impl dependent)
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    
    CONSTRAINT "availability_blocks_check_dates" CHECK (end_time > start_time)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "availability_blocks_user_id_idx" ON "public"."availability_blocks" ("user_id");
CREATE INDEX IF NOT EXISTS "availability_blocks_time_range_idx" ON "public"."availability_blocks" ("start_time", "end_time");

-- 5. Row Level Security (RLS) for availability_blocks
ALTER TABLE "public"."availability_blocks" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see all blocks (needed for matching engine and calendar views)
-- We might want to restrict this to only shared contacts later, but for matching it needs to be accessible.
-- For privacy, we might only expose 'busy' status to others, but RLS hides rows completely. 
-- Let's allow authenticated users to read blocks to facilitate scheduling.
CREATE POLICY "Authenticated users can view availability blocks"
ON "public"."availability_blocks"
FOR SELECT
TO authenticated
USING (true);

-- Policy: Users can only insert/update/delete their own blocks
CREATE POLICY "Users can manage their own availability blocks"
ON "public"."availability_blocks"
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION "public"."update_availability_blocks_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "update_availability_blocks_updated_at"
BEFORE UPDATE ON "public"."availability_blocks"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_availability_blocks_updated_at"();

-- ============================================================================
-- 7. Enhanced Matching Workflow Columns
-- ============================================================================

-- Professional acceptance tracking on matched_services
ALTER TABLE "public"."matched_services"
ADD COLUMN IF NOT EXISTS "professional_accepted_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "survivor_accepted_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "proposed_meeting_times" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "chat_id" uuid REFERENCES "public"."chats"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "decline_reason" text;

-- Add index for chat lookup
CREATE INDEX IF NOT EXISTS "matched_services_chat_id_idx" ON "public"."matched_services" ("chat_id");

-- ============================================================================
-- 8. Out of Office - Service Auto-Deactivation
-- ============================================================================

-- Add auto-inactive flag to support_services
ALTER TABLE "public"."support_services"
ADD COLUMN IF NOT EXISTS "auto_inactive_when_ooo" boolean DEFAULT true;

-- Store previous active state to restore when returning
ALTER TABLE "public"."profiles"
ADD COLUMN IF NOT EXISTS "services_active_before_ooo" jsonb DEFAULT '[]'::jsonb;

-- ============================================================================
-- 9. Enhanced Chat Metadata for Case Integration
-- ============================================================================

-- Add match_id to chats metadata is sufficient (JSONB), but let's add a direct FK for performance
ALTER TABLE "public"."chats"
ADD COLUMN IF NOT EXISTS "match_id" uuid REFERENCES "public"."matched_services"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "chats_match_id_idx" ON "public"."chats" ("match_id");

-- ============================================================================
-- 10. Message Delivery Status
-- ============================================================================

-- Add delivery timestamp for receipts
ALTER TABLE "public"."messages"
ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "reply_to_id" uuid REFERENCES "public"."messages"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "messages_reply_to_idx" ON "public"."messages" ("reply_to_id");

-- ============================================================================
-- 11. Functions for Availability Checking
-- ============================================================================

-- Function to check if a time slot is available for a user
CREATE OR REPLACE FUNCTION "public"."is_time_slot_available"(
    p_user_id uuid,
    p_start_time timestamp with time zone,
    p_end_time timestamp with time zone
)
RETURNS boolean AS $$
DECLARE
    has_conflict boolean;
BEGIN
    -- Check for overlapping availability blocks
    SELECT EXISTS (
        SELECT 1 FROM "public"."availability_blocks"
        WHERE user_id = p_user_id
        AND start_time < p_end_time
        AND end_time > p_start_time
    ) INTO has_conflict;
    
    IF has_conflict THEN
        RETURN false;
    END IF;
    
    -- Check for overlapping appointments
    SELECT EXISTS (
        SELECT 1 FROM "public"."appointments"
        WHERE (professional_id = p_user_id OR survivor_id = p_user_id)
        AND status IN ('pending', 'confirmed')
        AND appointment_date < p_end_time
        AND (appointment_date + (duration_minutes || ' minutes')::interval) > p_start_time
    ) INTO has_conflict;
    
    RETURN NOT has_conflict;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get available slots for a professional on a given day
CREATE OR REPLACE FUNCTION "public"."get_available_slots"(
    p_user_id uuid,
    p_date date,
    p_slot_duration_minutes integer DEFAULT 60
)
RETURNS TABLE (
    slot_start timestamp with time zone,
    slot_end timestamp with time zone
) AS $$
DECLARE
    day_start timestamp with time zone;
    day_end timestamp with time zone;
    current_slot timestamp with time zone;
BEGIN
    -- Default working hours: 8 AM to 6 PM
    day_start := (p_date || ' 08:00:00')::timestamp with time zone;
    day_end := (p_date || ' 18:00:00')::timestamp with time zone;
    
    current_slot := day_start;
    
    WHILE current_slot + (p_slot_duration_minutes || ' minutes')::interval <= day_end LOOP
        IF "public"."is_time_slot_available"(
            p_user_id, 
            current_slot, 
            current_slot + (p_slot_duration_minutes || ' minutes')::interval
        ) THEN
            slot_start := current_slot;
            slot_end := current_slot + (p_slot_duration_minutes || ' minutes')::interval;
            RETURN NEXT;
        END IF;
        current_slot := current_slot + (p_slot_duration_minutes || ' minutes')::interval;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 12. Trigger to auto-deactivate services when out of office
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."handle_out_of_office_change"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.out_of_office = true AND OLD.out_of_office = false THEN
        -- Store current active services before deactivating
        UPDATE "public"."profiles"
        SET services_active_before_ooo = (
            SELECT jsonb_agg(id)
            FROM "public"."support_services"
            WHERE user_id = NEW.id AND is_active = true AND auto_inactive_when_ooo = true
        )
        WHERE id = NEW.id;
        
        -- Deactivate services
        UPDATE "public"."support_services"
        SET is_active = false
        WHERE user_id = NEW.id AND auto_inactive_when_ooo = true;
        
    ELSIF NEW.out_of_office = false AND OLD.out_of_office = true THEN
        -- Reactivate previously active services
        UPDATE "public"."support_services"
        SET is_active = true
        WHERE user_id = NEW.id 
        AND id = ANY(
            SELECT jsonb_array_elements_text(NEW.services_active_before_ooo)::uuid
        );
        
        -- Clear the stored state
        NEW.services_active_before_ooo := '[]'::jsonb;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trigger_out_of_office_change" ON "public"."profiles";
CREATE TRIGGER "trigger_out_of_office_change"
BEFORE UPDATE OF out_of_office ON "public"."profiles"
FOR EACH ROW
EXECUTE FUNCTION "public"."handle_out_of_office_change"();

-- ============================================================================
-- 13. Enable Realtime for new/modified tables
-- ============================================================================

ALTER TABLE "public"."availability_blocks" REPLICA IDENTITY FULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
