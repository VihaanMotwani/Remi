import { fetchTodaysBriefing } from './dailyBriefingApi';
import type { DailyBriefing, BriefingTask } from 'src/types';

export type DailyTaskSummary = {
  stats: {
    meetings: number;
    urgent: number;
    followUps: number;
  };
  nextMeeting?: {
    title: string;
    time?: string;
    priority?: string;
  };
  urgent: BriefingTask[];
  followUps: BriefingTask[];
  summarySnippet?: string;
  generatedAt: string;
};

function normalize(briefing: DailyBriefing): DailyTaskSummary {
  const meetingsSorted = [...(briefing.meetings_today || [])].sort((a, b) => {
    const at = a.time ? new Date(a.time).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.time ? new Date(b.time).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  const snippet = (briefing.summary_text || '').trim();
  const summarySnippet = snippet
    ? (snippet.length > 160 ? snippet.slice(0, 157) + '…' : snippet)
    : undefined;

  return {
    stats: {
      meetings: briefing.meetings_today?.length || 0,
      urgent: briefing.urgent_tasks?.length || 0,
      followUps: briefing.follow_up_tasks?.length || 0,
    },
    nextMeeting: meetingsSorted[0]
      ? {
          title: meetingsSorted[0].title,
          time: meetingsSorted[0].time || undefined,
          priority: meetingsSorted[0].priority,
        }
      : undefined,
    urgent: (briefing.urgent_tasks || []).slice(0, 5),
    followUps: (briefing.follow_up_tasks || []).slice(0, 5),
    summarySnippet,
    generatedAt: briefing.date,
  };
}

export async function fetchDailyTaskSummary(): Promise<DailyTaskSummary | null> {
  const briefing = await fetchTodaysBriefing();
  if (!briefing) return null;
  return normalize(briefing);
}
