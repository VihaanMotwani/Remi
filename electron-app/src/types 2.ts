export interface EventType {
  id: string;
  title: string;
  start: Date;
  end: Date;
  priority: 'urgent' | 'high' | 'low';
  type: 'event' | 'task';
  completed?: boolean;
}
