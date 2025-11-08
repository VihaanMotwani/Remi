import { DBEventType, Meeting } from 'src/types';
import { supabase } from '../api/supabaseClient';
import { startOfDay, endOfDay } from 'date-fns';

// 🕒 Use local time range (not UTC)
function getTodayRangeLocal() {
  const now = new Date();
  const start = startOfDay(now).toISOString();
  const end = endOfDay(now).toISOString();
  return { start, end };
}

export async function fetchTodaysMeetings(): Promise<Meeting[]> {
  const { start, end } = getTodayRangeLocal();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_task', false)
    // include meetings that start or end today (handle overlaps)
    .or(`and(start_time.lte.${end},end_time.gte.${start})`)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching today events:', error);
    throw error;
  }

  if (!data) {
    console.warn('fetchTodaysMeetings: no data returned');
    return [];
  }

  // Deduplicate by event ID
  const uniqueEventsMap = new Map<string, DBEventType>();
  data.forEach(event => uniqueEventsMap.set(event.id, event));
  const uniqueEvents = Array.from(uniqueEventsMap.values());

  try {
    return uniqueEvents
      .filter(e => e.start_time && e.end_time)
      .map(e => {
        const startTime = new Date(e.start_time);
        const endTime = new Date(e.end_time);
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

        return {
          id: e.id,
          startTime,
          durationMinutes,
          title: e.title,
          attendees: e.attendees ?? [],
          agenda: e.description ?? '',
          preparationNotes: e.notes ?? '',
          meetingNotes: e.ai_summary ?? '',
          actionItems: e.action_items ? JSON.stringify(e.action_items, null, 2) : '',
        };
      });
  } catch (e) {
    console.error('Error mapping events:', e);
    throw e;
  }
}
