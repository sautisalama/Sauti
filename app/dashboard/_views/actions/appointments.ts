import { createClient } from "@/utils/supabase/client";
import { TablesInsert } from "@/types/db-schema";

export async function createAppointment(
  appointment: TablesInsert<"appointments">
) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from("appointments")
    .insert([appointment]);

  if (error) {
    console.error("Error creating appointment:", error);
    throw error;
  }
} 