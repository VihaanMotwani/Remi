import { supabase } from './supabaseClient';
import { startOfDay, endOfDay } from 'date-fns';
import type { Meeting } from 'src/types';

/**
 * Fetch all meetings (non-task events) from the events table.
 * Normalizes fields into the Meeting shape used by the UI.
 */
export async function fetchAllMeetings(): Promise<Meeting[]> {
	const todayStart = startOfDay(new Date()).toISOString();
	const todayEnd = endOfDay(new Date()).toISOString();

	const { data: events, error } = await supabase
		.from('events')
		.select('*')
		.eq('is_task', false)
		.gte('start_time', todayStart)
		.lt('start_time', todayEnd)
		.order('start_time', { ascending: true });
        

	if (error) {
		console.error('Error fetching events:', error);
		return [];
	}

	return (events || []).map((event: any) => {
		const start = event.start_time ? new Date(event.start_time) : new Date();
		const end = event.end_time ? new Date(event.end_time) : null;
		const durationMinutes = end
			? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
			: (event.duration_minutes ?? 30);

		// Normalize action items into string[] or empty string
		let actionItems: string | string[] = '';
		const raw = event.action_items;
		if (Array.isArray(raw)) {
			actionItems = raw.map(a => (typeof a === 'string' ? a : JSON.stringify(a)));
		} else if (raw && typeof raw === 'object') {
			const maybeList = (raw as any).items || Object.values(raw);
			actionItems = Array.isArray(maybeList)
				? maybeList.map(a => (typeof a === 'string' ? a : JSON.stringify(a)))
				: [JSON.stringify(raw)];
		} else if (typeof raw === 'string') {
			actionItems = raw.split('\n').filter(Boolean);
		}

		const meeting: Meeting = {
			id: event.id,
			title: event.title ?? 'Untitled Meeting',
			startTime: start,
			durationMinutes,
			attendees: event.attendees ?? [],
			agenda: event.description ?? '', // Map description to agenda slot
			preparationNotes: event.notes ?? '',
			meetingNotes: '', // Not provided in events table
			actionItems,
		};
		return meeting;
	});
}
