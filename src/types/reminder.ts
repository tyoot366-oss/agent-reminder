export type RepeatRule = 'none' | 'half_hourly' | 'hourly' | 'daily' | 'weekly';

export interface ReminderItem {
  id: string;
  title: string;
  notes?: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  repeat: RepeatRule;
  isCompleted: boolean;
  createdAt: number;
  updatedAt: number;
  notificationId?: string;
}

export interface CreateReminderInput {
  id?: string;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  repeat?: RepeatRule;
}
