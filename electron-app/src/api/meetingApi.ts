import { supabase } from './supabaseClient';
import { startOfDay, endOfDay } from 'date-fns';
import { Meeting } from 'src/types';

export async function fetchTodaysMeetings(): Promise<Meeting[]> {
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  // Fetch only events (exclude tasks)
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('is_task', false)         // <-- Exclude tasks here
    .gte('start_time', todayStart)
    .lt('start_time', todayEnd)
    .order('start_time', { ascending: true });

  if (eventsError) {
    console.error('Error fetching events:', eventsError);
    return [];
  }

  const eventIds = events.map(e => e.id);
  const { data: notes, error: notesError } = await supabase
    .from('meeting_notes')
    .select('*')
    .in('meeting_id', eventIds);

  if (notesError) {
    console.error('Error fetching meeting notes:', notesError);
  }

  console.log(events);
  return events.map(event => {
    const note = notes?.find(n => n.meeting_id === event.id);
    // Normalize action items: if object or array, flatten to string[]; if string, split by newline.
    let actionItems: string | string[] = '';
    const rawAction = note?.action_items;
    if (Array.isArray(rawAction)) {
      actionItems = rawAction.map(a => (typeof a === 'string' ? a : JSON.stringify(a)));
    } else if (typeof rawAction === 'object' && rawAction) {
      // If it's an object, try common shapes (e.g., {items: [...]})
      const maybeList = (rawAction as any).items || Object.values(rawAction);
      actionItems = Array.isArray(maybeList)
        ? maybeList.map(a => (typeof a === 'string' ? a : JSON.stringify(a)))
        : [JSON.stringify(rawAction)];
    } else if (typeof rawAction === 'string') {
      actionItems = rawAction.split('\n').filter(Boolean);
    }

    return {
      id: event.id,
      title: event.title ?? 'Untitled Meeting',
      startTime: new Date(event.start_time),
      durationMinutes: event.duration_minutes ?? 30,
      attendees: event.attendees ?? [],
      agenda: event.agenda ?? '',
      preparationNotes: note?.preparation_notes ?? '',
      meetingNotes: note?.notes ?? '',
      actionItems,
    };
  });
}
