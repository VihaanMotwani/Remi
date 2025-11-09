import { supabase } from './supabaseClient';
import { DailyBriefing } from 'src/types';
import { startOfDay, endOfDay } from 'date-fns';

export async function fetchTodaysBriefing(): Promise<DailyBriefing | null> {
  const start = startOfDay(new Date()).toISOString();
  const end = endOfDay(new Date()).toISOString();

  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching daily briefing:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const row = data[0];
  // Basic runtime type normalization
  return {
    greeting: row.greeting || 'Good morning!',
    urgent_tasks: Array.isArray(row.urgent_tasks) ? row.urgent_tasks : [],
    follow_up_tasks: Array.isArray(row.follow_up_tasks) ? row.follow_up_tasks : [],
    meetings_today: Array.isArray(row.meetings_today) ? row.meetings_today : [],
    summary_text: row.summary_text || '',
    date: row.date,
  } as DailyBriefing;
}
