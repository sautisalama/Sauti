-- Professional Portal Redesign Migration
-- Date: 2026-02-08
-- Description: Adds communities, blogs, case recommendations, case shares tables
--              Modifies reports and matched_services tables

-- ============================================================
-- PART 1: ENUM MODIFICATIONS
-- ============================================================

-- Add 'community' to chat_type enum if it doesn't exist
DO $$ 
BEGIN
    -- Check if 'community' value already exists in chat_type
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'community' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'chat_type')
    ) THEN
        ALTER TYPE chat_type ADD VALUE 'community';
    END IF;
END $$;

-- Create blog_status enum
DO $$ BEGIN
    CREATE TYPE blog_status_type AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'published');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create community_role enum
DO $$ BEGIN
    CREATE TYPE community_role_type AS ENUM ('admin', 'moderator', 'member');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create invitation_status enum
DO $$ BEGIN
    CREATE TYPE invitation_status_type AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create case_share_status enum
DO $$ BEGIN
    CREATE TYPE case_share_status_type AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PART 2: NEW TABLES
-- ============================================================

-- Communities table
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    avatar_url TEXT,
    is_public BOOLEAN DEFAULT true,
    member_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Community members table
CREATE TABLE IF NOT EXISTS community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role community_role_type DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

-- Community invitations table
CREATE TABLE IF NOT EXISTS community_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status invitation_status_type DEFAULT 'pending',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(community_id, invitee_id)
);

-- Blogs table for professional content
CREATE TABLE IF NOT EXISTS blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    category TEXT,
    tags JSONB,
    status blog_status_type DEFAULT 'draft',
    admin_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case recommendations table
CREATE TABLE IF NOT EXISTS case_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matched_services(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_shared_with_survivor BOOLEAN DEFAULT false,
    shared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case shares/forwards table
CREATE TABLE IF NOT EXISTS case_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matched_services(id) ON DELETE CASCADE,
    from_professional_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    to_professional_id UUID REFERENCES profiles(id),
    to_service_pool BOOLEAN DEFAULT false,
    include_notes BOOLEAN DEFAULT false,
    include_recommendations BOOLEAN DEFAULT false,
    required_services JSONB,
    reason TEXT,
    original_match_date TIMESTAMP WITH TIME ZONE,
    support_history JSONB,
    status case_share_status_type DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- PART 3: TABLE MODIFICATIONS
-- ============================================================

-- Add record_only column to reports table
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS record_only BOOLEAN DEFAULT false;

-- Add recommendations JSON column to matched_services
ALTER TABLE matched_services 
ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- Add shared_from column to track case forwarding source
ALTER TABLE matched_services
ADD COLUMN IF NOT EXISTS shared_from_match_id UUID REFERENCES matched_services(id);

-- ============================================================
-- PART 4: INDEXES
-- ============================================================

-- Communities indexes
CREATE INDEX IF NOT EXISTS idx_communities_creator_id ON communities(creator_id);
CREATE INDEX IF NOT EXISTS idx_communities_is_public ON communities(is_public);

-- Community members indexes
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);

-- Community invitations indexes
CREATE INDEX IF NOT EXISTS idx_community_invitations_invitee_id ON community_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_status ON community_invitations(status);

-- Blogs indexes
CREATE INDEX IF NOT EXISTS idx_blogs_author_id ON blogs(author_id);
CREATE INDEX IF NOT EXISTS idx_blogs_status ON blogs(status);
CREATE INDEX IF NOT EXISTS idx_blogs_published_at ON blogs(published_at);

-- Case recommendations indexes
CREATE INDEX IF NOT EXISTS idx_case_recommendations_match_id ON case_recommendations(match_id);
CREATE INDEX IF NOT EXISTS idx_case_recommendations_professional_id ON case_recommendations(professional_id);

-- Case shares indexes
CREATE INDEX IF NOT EXISTS idx_case_shares_match_id ON case_shares(match_id);
CREATE INDEX IF NOT EXISTS idx_case_shares_from_professional_id ON case_shares(from_professional_id);
CREATE INDEX IF NOT EXISTS idx_case_shares_to_professional_id ON case_shares(to_professional_id);
CREATE INDEX IF NOT EXISTS idx_case_shares_status ON case_shares(status);

-- ============================================================
-- PART 5: TRIGGERS
-- ============================================================

-- Update trigger for communities
DROP TRIGGER IF EXISTS update_communities_updated_at ON communities;
CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update trigger for blogs
DROP TRIGGER IF EXISTS update_blogs_updated_at ON blogs;
CREATE TRIGGER update_blogs_updated_at
    BEFORE UPDATE ON blogs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update trigger for case_recommendations
DROP TRIGGER IF EXISTS update_case_recommendations_updated_at ON case_recommendations;
CREATE TRIGGER update_case_recommendations_updated_at
    BEFORE UPDATE ON case_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PART 6: COMMUNITY MEMBER COUNT TRIGGER
-- ============================================================

-- Function to update community member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE communities SET member_count = member_count - 1 WHERE id = OLD.community_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for member count
DROP TRIGGER IF EXISTS trigger_update_community_member_count ON community_members;
CREATE TRIGGER trigger_update_community_member_count
    AFTER INSERT OR DELETE ON community_members
    FOR EACH ROW
    EXECUTE FUNCTION update_community_member_count();

-- ============================================================
-- PART 7: BLOG SLUG GENERATION
-- ============================================================

-- Function to generate blog slug
CREATE OR REPLACE FUNCTION generate_blog_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from title
    base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
    final_slug := base_slug;
    
    -- Check for uniqueness and append counter if needed
    WHILE EXISTS (SELECT 1 FROM blogs WHERE slug = final_slug AND id != NEW.id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for blog slug generation
DROP TRIGGER IF EXISTS trigger_generate_blog_slug ON blogs;
CREATE TRIGGER trigger_generate_blog_slug
    BEFORE INSERT OR UPDATE OF title ON blogs
    FOR EACH ROW
    EXECUTE FUNCTION generate_blog_slug();

-- ============================================================
-- PART 8: ENABLE REALTIME
-- ============================================================

ALTER TABLE communities REPLICA IDENTITY FULL;
ALTER TABLE community_members REPLICA IDENTITY FULL;
ALTER TABLE community_invitations REPLICA IDENTITY FULL;
ALTER TABLE blogs REPLICA IDENTITY FULL;
ALTER TABLE case_recommendations REPLICA IDENTITY FULL;
ALTER TABLE case_shares REPLICA IDENTITY FULL;

-- ============================================================
-- PART 9: RLS POLICIES (Initially disabled for development)
-- ============================================================

ALTER TABLE communities DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE blogs DISABLE ROW LEVEL SECURITY;
ALTER TABLE case_recommendations DISABLE ROW LEVEL SECURITY;
ALTER TABLE case_shares DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- DONE
-- ============================================================
