"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useUser } from "@/hooks/useUser";
import { SereneActivityItem, SereneSectionHeader } from "../_components/SurvivorDashboardComponents";
import { Bell, Calendar, CheckCircle, MessageCircle, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, isSameDay, subDays, parseISO } from "date-fns";

export default function ActivityPage() {
  const user = useUser();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     const fetchActivity = async () => {
        if (!user?.id) return;
        const supabase = createClient();
        
        // We'll simulate a unified stream by fetching notifications, report updates, and appointments
        // In a real production app, this might be a dedicated 'activity_feed' view or table
        
        const { data: notifications } = await supabase
           .from('notifications')
           .select('*')
           .eq('user_id', user.id)
           .order('created_at', { ascending: false })
           .limit(20);

        setActivities(notifications || []);
        setLoading(false);
     };

     fetchActivity();
  }, [user?.id]);

  const getIconForType = (type: string) => {
     switch (type) {
        case 'match': return <Shield className="h-5 w-5" />;
        case 'message': return <MessageCircle className="h-5 w-5" />;
        case 'appointment': return <Calendar className="h-5 w-5" />;
        default: return <Bell className="h-5 w-5" />;
     }
  };

  const groupedActivities = activities.reduce((acc, curr) => {
     if (!curr.created_at) return acc;
     const date = isSameDay(parseISO(curr.created_at), new Date()) 
        ? 'Today' 
        : isSameDay(parseISO(curr.created_at), subDays(new Date(), 1))
           ? 'Yesterday'
           : 'Earlier';
     if (!acc[date]) acc[date] = [];
     acc[date].push(curr);
     return acc;
  }, {} as Record<string, any[]>);

  const groups = ['Today', 'Yesterday', 'Earlier'].filter(g => groupedActivities[g]);

  return (
    <div className="min-h-screen bg-serene-neutral-50 pb-24">
       <div className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-serene-neutral-200/60 px-4 py-4">
          <div className="max-w-xl mx-auto">
             <h1 className="text-xl font-bold text-serene-neutral-900 tracking-tight">Activity</h1>
          </div>
       </div>

       <div className="max-w-xl mx-auto px-4 pt-6 space-y-8">
          {loading ? (
             <div className="space-y-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
             </div>
          ) : activities.length > 0 ? (
             groups.map(group => (
                <div key={group}>
                   <h3 className="text-xs font-bold text-serene-neutral-400 uppercase tracking-wider mb-3 px-1">
                      {group}
                   </h3>
                   <div className="space-y-2">
                      {groupedActivities[group].map((item: any) => (
                         <SereneActivityItem
                            key={item.id}
                            title={item.title || "Update"}
                            description={item.body || ""}
                            time={item.created_at ? formatDistanceToNow(parseISO(item.created_at), { addSuffix: true }) : "Just now"}
                            icon={getIconForType(item.type || "")}
                            isUnread={!!item.read === false}
                         />
                      ))}
                   </div>
                </div>
             ))
          ) : (
             <div className="text-center py-20">
                <div className="bg-serene-neutral-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Bell className="h-6 w-6 text-serene-neutral-400" />
                </div>
                <h3 className="text-lg font-bold text-serene-neutral-900">No recent activity</h3>
                <p className="text-serene-neutral-500 text-sm mt-1">
                   Notifications and updates will appear here.
                </p>
             </div>
          )}
       </div>
    </div>
  );
}
