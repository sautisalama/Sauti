import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { professionalId, date, type, duration, clientInfo } = body;

    const supabase = await createClient();

    // Create or find survivor profile based on email
    let survivorId: string;
    
    // Check if user already exists with this email
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', clientInfo.email)
      .single();

    if (existingProfile) {
      survivorId = existingProfile.id;
    } else {
      // Create a new profile for the survivor
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          first_name: clientInfo.firstName,
          last_name: clientInfo.lastName,
          email: clientInfo.email,
          phone: clientInfo.phone,
          user_type: 'survivor',
          is_public_booking: true,
        })
        .select('id')
        .single();

      if (profileError) {
        throw profileError;
      }

      survivorId = newProfile.id;
    }

    // Create the appointment with status as 'requested' (requires professional confirmation)
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        professional_id: professionalId,
        survivor_id: survivorId,
        appointment_date: date,
        appointment_type: type,
        duration_minutes: duration,
        status: 'requested', // Professional needs to confirm
        notes: clientInfo.notes,
        emergency_contact: clientInfo.emergencyContact,
        created_via: 'public_booking',
      })
      .select()
      .single();

    if (appointmentError) {
      throw appointmentError;
    }

    // Send notification email to professional
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/appointment-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appointment.appointment_id,
          professionalId,
          clientInfo,
          appointmentDate: date,
          appointmentType: type,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the appointment creation if email fails
    }

    return NextResponse.json({ 
      success: true, 
      appointmentId: appointment.appointment_id,
      message: 'Appointment request submitted successfully' 
    });

  } catch (error) {
    console.error('Error creating public appointment:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment request' },
      { status: 500 }
    );
  }
}
