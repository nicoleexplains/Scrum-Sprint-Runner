
import type { ColumnId } from './types';

export const ItemTypes = {
  TASK: 'task',
};

export const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: 'backlog', title: 'Product Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];
