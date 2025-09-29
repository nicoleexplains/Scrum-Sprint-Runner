
export type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  column: ColumnId;
  title: string;
  description: string;
  points: number;
}

export interface Sprint {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    goal: string;
}
