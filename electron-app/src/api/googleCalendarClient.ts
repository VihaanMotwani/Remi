import { supabase } from './supabaseClient'
import { startOfDay, endOfDay } from 'date-fns'
import { EventType, DBEventType } from "src/types";

export async function fetchTodaysEvents(): Promise<EventType[]> {
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .lt('start_time', todayEnd)
    .gt('end_time', todayStart)
    .order('start_time', { ascending: true });

  // Fetch tasks (assuming is_task is a boolean column)
  const { data: tasks, error: tasksError } = await supabase
    .from('events')
    .select('*')
    .eq('is_task', true)
    .lte('end_time', todayEnd)
    .order('start_time', { ascending: true });

  // Handle errors (optional)
  if (eventsError) {
    console.error('Error fetching events:', eventsError);
  }

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
  }

  // Combine arrays safely
  const combined = [...(events || []), ...(tasks || [])];
  const data = combined;

  if (!data) {
    console.warn('fetchTodaysEvents: no data returned');
    return [];
  }

  // Deduplicate by event id here:
  const uniqueEventsMap = new Map<string, typeof data[0]>();
  data.forEach(event => uniqueEventsMap.set(event.id, event));
  const uniqueEvents = Array.from(uniqueEventsMap.values());

  try {
    return uniqueEvents.map((event: DBEventType) => ({
      id: event.id,
      title: event.title,
      start: event.start_time ? new Date(event.start_time) : new Date(),
      end: event.end_time ? new Date(event.end_time) : new Date(),
      priority: event.action_items?.priority || 'low',
      type: event.is_task ? 'task' : 'event',
      completed: event.action_items?.completed || false,
    }));
  } catch (e) {
    console.error('Error mapping events:', e);
    throw e;
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