export type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'blocked' | 'done';

export interface Attachment {
  name: string;
  type: string;
  data: string; // base64 encoded file content
}

export interface Task {
  id: string;
  column: ColumnId;
  title: string;
  description: string;
  points: number;
  attachments?: Attachment[];
}

export interface Sprint {
    id: string;
    name:string;
    startDate: Date;
    endDate: Date;
    goal: string;
}