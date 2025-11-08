import { DBEventType, Meeting } from 'src/types';
import { supabase } from '../api/supabaseClient';

function getTodayRangeUTC() {
  const now = new Date();
  const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start: startUTC.toISOString(), end: endUTC.toISOString() };
}

export async function fetchTodaysMeetings(): Promise<Meeting[]> {
  const { start, end } = getTodayRangeUTC();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_task', false)
    .lte('start_time', end)
    .gte('end_time', start)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching today events:', error);
    throw error;
  }

  if (!data) {
    console.warn('fetchTodaysEvents: no data returned');
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
