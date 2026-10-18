import {
  Calendar,
  CalendarOff,
  Users,
  Clock,
  CalendarDays,
  ClipboardCheck,
  Settings,
  Trash2,
  type LucideIcon
} from 'lucide-react';

export interface SectionVisual {
  icon: LucideIcon;
  color: string;
}

export const SECTIONS: Record<string, SectionVisual> = {
  requests: {
    icon: Calendar,
    color: 'amber'
  },
  absences: {
    icon: CalendarOff,
    color: 'amber'
  },
  persons: {
    icon: Users,
    color: 'amber'
  },
  attendance: {
    icon: Clock,
    color: 'amber'
  },
  timesheets: {
    icon: CalendarDays,
    color: 'amber'
  },
  closures: {
    icon: ClipboardCheck,
    color: 'amber'
  },
  settings: {
    icon: Settings,
    color: 'amber'
  },
  trash: {
    icon: Trash2,
    color: 'rose'
  }
};
