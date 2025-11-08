import { supabase } from './supabaseClient'
import { startOfDay, endOfDay } from 'date-fns'
import { EventType, DBEventType } from "src/types";

export async function fetchTodaysEvents(): Promise<EventType[]> {
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  try {
    // Fetch calendar events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .not('start_time', 'is', null)
      .lt('start_time', todayEnd)
      .gt('end_time', todayStart);

    if (eventsError) throw eventsError;

    // Fetch tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('events')
      .select('*')
      .eq('is_task', true)
      .lt('end_time', todayEnd)
      .gt('end_time', todayStart);

    if (tasksError) throw tasksError;

    // Combine both
    const data = [...(events || []), ...(tasks || [])];
    console.log("🧩 Combined:", data.length);


    // Deduplicate by event id
    const uniqueEventsMap = new Map<string, typeof data[0]>();
    data.forEach(event => uniqueEventsMap.set(event.id, event));
    const uniqueEvents = Array.from(uniqueEventsMap.values());

    // Map to frontend type
    return uniqueEvents.map((event: DBEventType) => ({
      id: event.id,
      title: event.title,
      start: event.start_time ? new Date(event.start_time) : new Date(event.end_time),
      end: event.end_time ? new Date(event.end_time) : new Date(),
      priority: event.action_items?.priority || 'low',
      type: event.is_task ? 'task' : 'event',
      completed: event.action_items?.completed || false,
    }));
  } catch (error) {
    console.error('Error fetching today events and tasks:', error);
    throw error;
  }
}


export async function updateEvent(eventData: DBEventType): Promise<DBEventType> {
  const { id, created_at, ...updates } = eventData;

  if (!id) {
    throw new Error('Event ID is required for update');
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error("Error updating event:", error);
    throw error;
  }
  
  if (!data) {
    throw new Error('No data returned from update');
  }
  
  return data;
}


export async function createEvent(eventData: Omit<DBEventType, 'id' | 'created_at'>): Promise<DBEventType> {
  const { data, error } = await supabase
    .from('events')
    .insert([eventData])
    .select('*')
    .single();

  if (error) {
    console.error("Error creating event:", error);
    throw error;
  }
  
  if (!data) {
    throw new Error('No data returned from create');
  }
  
  return data;
}


export async function deleteEvent(eventId: string): Promise<void> {
  if (!eventId) {
    throw new Error('Event ID is required for deletion');
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
}