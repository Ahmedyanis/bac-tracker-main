import {
  BookOpen, Landmark, Sigma, Atom, FlaskConical, Languages, Code2,
} from 'lucide-react';

export const SUBJECTS = [
  { key: 'islamic', label: 'Islamic Education', short: 'Islamic Ed.', icon: BookOpen, color: '#34D399' },
  { key: 'history', label: 'History', short: 'History', icon: Landmark, color: '#F2B84B' },
  { key: 'math', label: 'Math', short: 'Math', icon: Sigma, color: '#5B8DEF' },
  { key: 'physics', label: 'Physics', short: 'Physics', icon: Atom, color: '#B980F0' },
  { key: 'science', label: 'Science', short: 'Science', icon: FlaskConical, color: '#4FD1C5' },
  { key: 'english', label: 'English', short: 'English', icon: Languages, color: '#F472B6' },
  { key: 'cs', label: 'Computer Science', short: 'CS', icon: Code2, color: '#FB923C' },
];

export function subjectByKey(key) {
  return SUBJECTS.find((s) => s.key === key) || SUBJECTS[0];
}
