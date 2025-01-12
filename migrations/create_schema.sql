-- Drop existing objects first (in reverse dependency order)
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS matched_services;
DROP TABLE IF EXISTS support_services;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS profiles;

DROP TYPE IF EXISTS appointment_status_type CASCADE;
DROP TYPE IF EXISTS consent_type CASCADE;
DROP TYPE IF EXISTS contact_preference_type CASCADE;
DROP TYPE IF EXISTS gender_type CASCADE;
DROP TYPE IF EXISTS incident_type CASCADE;
DROP TYPE IF EXISTS language_type CASCADE;
DROP TYPE IF EXISTS match_status_type CASCADE;
DROP TYPE IF EXISTS support_service_type CASCADE;
DROP TYPE IF EXISTS urgency_type CASCADE;
DROP TYPE IF EXISTS user_type CASCADE;

-- Create or replace ENUMs
DO $$ BEGIN
    CREATE TYPE appointment_status_type AS ENUM ('pending', 'confirmed');
    CREATE TYPE consent_type AS ENUM ('yes', 'no');
    CREATE TYPE contact_preference_type AS ENUM ('phone_call', 'sms', 'email', 'do_not_contact');
    CREATE TYPE gender_type AS ENUM ('female', 'male', 'non_binary', 'prefer_not_to_say');
    CREATE TYPE incident_type AS ENUM ('physical', 'emotional', 'sexual', 'financial', 'other');
    CREATE TYPE language_type AS ENUM ('english', 'swahili', 'other');
    CREATE TYPE match_status_type AS ENUM ('pending', 'accepted', 'declined', 'completed', 'cancelled');
    CREATE TYPE support_service_type AS ENUM ('legal', 'medical', 'mental_health', 'shelter', 'financial_assistance', 'other');
    CREATE TYPE urgency_type AS ENUM ('high', 'medium', 'low');
    CREATE TYPE user_type AS ENUM ('ngo', 'professional', 'survivor');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create Tables
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    user_type user_type,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    dob DATE,
    gender gender_type,
    preferred_language language_type,
    contact_preference contact_preference_type,
    consent consent_type,
    type_of_incident incident_type,
    incident_description TEXT,
    urgency urgency_type,
    location TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    city TEXT,
    state TEXT,
    country TEXT,
    country_code TEXT,
    postcode TEXT,
    locality TEXT,
    continent TEXT,
    continent_code TEXT,
    principal_subdivision TEXT,
    principal_subdivision_code TEXT,
    plus_code TEXT,
    administrative JSONB,
    required_services JSONB,
    additional_info TEXT,
    support_services support_service_type,
    isMatched BOOLEAN DEFAULT FALSE,
    match_status match_status_type,
    submission_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE support_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    service_types support_service_type NOT NULL,
    email TEXT,
    phone_number TEXT,
    helpline TEXT,
    website TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    coverage_area_radius DECIMAL,
    availability TEXT,
    priority INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE matched_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survivor_id UUID REFERENCES profiles(id),
    report_id UUID REFERENCES reports(report_id),
    service_id UUID REFERENCES support_services(id),
    support_service support_service_type,
    match_score DECIMAL,
    match_status_type match_status_type,
    match_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    notes TEXT,
    feedback TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointments (
    appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survivor_id UUID REFERENCES profiles(id),
    professional_id UUID REFERENCES profiles(id),
    matched_services UUID REFERENCES matched_services(id),
    appointment_date TIMESTAMP WITH TIME ZONE,
    status appointment_status_type,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_support_services_user_id ON support_services(user_id);
CREATE INDEX idx_matched_services_survivor_id ON matched_services(survivor_id);
CREATE INDEX idx_matched_services_report_id ON matched_services(report_id);
CREATE INDEX idx_matched_services_service_id ON matched_services(service_id);
CREATE INDEX idx_appointments_survivor_id ON appointments(survivor_id);
CREATE INDEX idx_appointments_professional_id ON appointments(professional_id);
CREATE INDEX idx_appointments_matched_services ON appointments(matched_services);

-- Create or replace function for timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers before creating them
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_matched_services_updated_at ON matched_services;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matched_services_updated_at
    BEFORE UPDATE ON matched_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create the trigger functions for user management
CREATE OR REPLACE FUNCTION handle_new_email_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, user_type, email)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'firstName',
        NEW.raw_user_meta_data->>'lastName',
        (NEW.raw_user_meta_data->>'userType')::public.user_type,
        NEW.email
    );
    RETURN NEW;
END;
$$ language plpgsql security definer;

CREATE OR REPLACE FUNCTION handle_new_google_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed with Google OAuth users
    IF EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(NEW.identities) 
        WHERE value->>'provider' = 'google'
        ) THEN
        INSERT INTO public.profiles (id, first_name, last_name, user_type, email)
        VALUES (
            NEW.id,
            (NEW.identities->0->>'identity_data')::jsonb->>'given_name',
            (NEW.identities->0->>'identity_data')::jsonb->>'family_name',
            (NEW.raw_user_meta_data->>'userType')::public.user_type,
            (NEW.identities->0->>'identity_data')::jsonb->>'email'
        );
        END IF;
        RETURN NEW;
END;
$$ language plpgsql security definer;

-- Create the triggers in the auth schema
CREATE TRIGGER on_auth_user_created_email
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN (NEW.email IS NOT NULL AND NEW.raw_user_meta_data->>'provider' = 'email')
    EXECUTE FUNCTION handle_new_email_user();

CREATE TRIGGER on_auth_user_created_google
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_google_user();

-- Enable realtime for all tables
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE reports REPLICA IDENTITY FULL;
ALTER TABLE support_services REPLICA IDENTITY FULL;
ALTER TABLE matched_services REPLICA IDENTITY FULL;
ALTER TABLE appointments REPLICA IDENTITY FULL;

-- Temporarily disable RLS on all tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE support_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE matched_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY; 