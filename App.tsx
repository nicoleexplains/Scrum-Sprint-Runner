import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { produce } from 'immer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { generateUserStories, summarizeRetrospective, analyzeTaskAttachments } from './services/geminiService';
import type { Task, ColumnId, Sprint, Attachment } from './types';
import { COLUMNS, ItemTypes } from './constants';

const initialTasks: Task[] = [
    { id: 'task-1', column: 'backlog', title: 'User Authentication Flow', description: 'Design and implement the complete user login and registration process.', points: 8, attachments: [] },
    { id: 'task-2', column: 'backlog', title: 'Setup CI/CD Pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', attachments: [] },
    { id: 'task-3', column: 'todo', title: 'Create Database Schema', description: 'Define the initial database schema for users and projects.', points: 5, attachments: [] },
    { id: 'task-4', column: 'in-progress', title: 'Develop Landing Page', description: 'Build the main marketing landing page with React and Tailwind.', points: 3, attachments: [] },
    { id: 'task-6', column: 'blocked', title: 'API Integration', description: 'Waiting for backend team to provide the new endpoint.', points: 5, attachments: [] },
    { id: 'task-5', column: 'done', title: 'Project Scaffolding', description: 'Initialize the React project with TypeScript and basic dependencies.', points: 2, attachments: [] },
];

const initialSprint: Sprint = {
  id: 'sprint-1',
  name: 'Sprint 1',
  startDate: new Date('2024-07-20T00:00:00Z'),
  endDate: new Date('2024-08-03T00:00:00Z'),
  goal: 'Launch the initial version of the marketing website and user authentication.',
};

const TaskCard: React.FC<{ task: Task; onClick: (task: Task) => void }> = ({ task, onClick }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.TASK,
    item: { id: task.id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const draggingStyles = 'opacity-50 transform rotate-3 scale-105 shadow-2xl';
  const baseStyles = `p-4 mb-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 cursor-pointer hover:shadow-xl transition-all duration-300 ease-in-out`;
  const borderColor = 
    task.column === 'done' ? 'border-green-500' :
    task.column === 'blocked' ? 'border-red-500' : 
    'border-primary';

  return (
    <div
      ref={drag}
      onClick={() => onClick(task)}
      className={`${baseStyles} ${borderColor} ${isDragging ? draggingStyles : 'opacity-100'}`}
      role="button"
      aria-label={`View details for ${task.title}`}
    >
      <h4 className="font-bold text-gray-800 dark:text-gray-100">{task.title}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-normal break-words">{task.description}</p>
      <div className="flex justify-between items-center mt-3">
        {task.attachments && task.attachments.length > 0 && (
          <span className="text-xs text-medium dark:text-gray-400">📎 {task.attachments.length}</span>
        )}
        {task.points && task.points > 0 && (
          <div className="text-xs font-semibold bg-primary text-white rounded-full px-2 py-1 inline-block ml-auto">
            {task.points} Points
          </div>
        )}
      </div>
    </div>
  );
};

const KanbanColumn: React.FC<{
  column: { id: ColumnId; title: string };
  tasks: Task[];
  moveTask: (taskId: string, targetColumn: ColumnId) => void;
  onAddTaskClick?: () => void;
  onTaskClick: (task: Task) => void;
}> = ({ column, tasks, moveTask, onAddTaskClick, onTaskClick }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.TASK,
    drop: (item: { id: string }) => moveTask(item.id, column.id),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const baseColumnStyles = 'flex-1 p-4 rounded-lg min-h-[400px] transition-all duration-300';
  const idleStyles = 'bg-gray-100 dark:bg-gray-900/50';
  const activeStyles = 'bg-indigo-100 dark:bg-gray-700 border-2 border-dashed border-primary';

  return (
    <div
      ref={drop}
      className={`${baseColumnStyles} ${isOver ? activeStyles : idleStyles}`}
    >
      <div className="flex justify-between items-center mb-4 border-b-2 border-primary pb-2">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
          {column.title} ({tasks.length})
        </h3>
        {onAddTaskClick && (
          <button 
            onClick={onAddTaskClick} 
            className="px-2 py-0.5 bg-primary text-white rounded-full text-lg font-bold leading-none hover:bg-primary-hover transition-transform duration-200 hover:scale-110"
            aria-label="Add new task"
          >
            +
          </button>
        )}
      </div>
      <div>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={onTaskClick} />
        ))}
      </div>
    </div>
  );
};


const RetrospectiveModal: React.FC<{
    onClose: () => void;
    setSummary: (summary: string) => void;
    setIsLoading: (loading: boolean) => void;
}> = ({ onClose, setSummary, setIsLoading }) => {
    const [wentWell, setWentWell] = useState('');
    const [couldImprove, setCouldImprove] = useState('');

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const summary = await summarizeRetrospective(wentWell.split('\n'), couldImprove.split('\n'));
            setSummary(summary);
        } catch (error) {
            console.error("Failed to summarize retrospective:", error);
            alert("Error summarizing retrospective. Check console for details.");
        } finally {
            setIsLoading(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl text-gray-800 dark:text-gray-100">
                <h2 className="text-2xl font-bold mb-6">Sprint Retrospective</h2>
                <div className="space-y-4">
                    <div>
                        <label className="font-semibold block mb-2">What went well?</label>
                        <textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} rows={5} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label className="font-semibold block mb-2">What could be improved?</label>
                        <textarea value={couldImprove} onChange={(e) => setCouldImprove(e.target.value)} rows={5} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover">Generate Summary</button>
                </div>
            </div>
        </div>
    );
};

const NewTaskModal: React.FC<{
    onClose: () => void;
    onAddTask: (task: { title: string; description: string; points?: number }) => void;
}> = ({ onClose, onAddTask }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [points, setPoints] = useState<number | ''>('');

    const handleSubmit = () => {
        if (!title.trim() || !description.trim()) {
            alert('Please fill in the title and description.');
            return;
        }
        onAddTask({ title, description, points: points !== '' ? Number(points) : undefined });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-lg text-gray-800 dark:text-gray-100">
                <h2 className="text-2xl font-bold mb-6">Add New Task to Backlog</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="font-semibold block mb-2">Title</label>
                        <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="description" className="font-semibold block mb-2">Description</label>
                        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                     <div>
                        <label htmlFor="points" className="font-semibold block mb-2">Story Points (Optional)</label>
                        <input id="points" type="number" value={points} onChange={(e) => setPoints(e.target.value === '' ? '' : parseInt(e.target.value, 10))} min="0" className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover">Add Task</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TaskDetailModal: React.FC<{
    task: Task;
    onClose: () => void;
    onSave: (updatedTask: Task) => void;
    onDelete: (taskId: string) => void;
}> = ({ task, onClose, onSave, onDelete }) => {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description);
    const [points, setPoints] = useState<number | ''>(task.points || '');
    const [column, setColumn] = useState<ColumnId>(task.column);
    const [attachments, setAttachments] = useState<Attachment[]>(task.attachments || []);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleSubmit = () => {
        if (!title.trim()) {
            alert('Title is required.');
            return;
        }
        onSave({
            ...task,
            title,
            description,
            points: points !== '' ? Number(points) : undefined,
            column,
            attachments,
        });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            onDelete(task.id);
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        // Fix: Explicitly type `file` as `File` to resolve a potential type inference issue where `file` was being treated as `unknown`.
        Array.from(files).forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result as string;
                if (data) {
                    setAttachments(prev => [...prev, { name: file.name, type: file.type, data }]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleAnalyzeAttachments = async () => {
        if (attachments.length === 0) {
            alert("Please attach at least one file to analyze.");
            return;
        }
        setIsAnalyzing(true);
        try {
            const summary = await analyzeTaskAttachments(title, attachments);
            setDescription(prev => `${prev}\n\n--- AI Analysis ---\n${summary}`);
        } catch (error) {
            console.error("Failed to analyze attachments:", error);
            alert("Error analyzing attachments. Check console for details.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl text-gray-800 dark:text-gray-100 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6">Edit Task Details</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                    <div>
                        <label htmlFor="edit-title" className="font-semibold block mb-2">Title</label>
                        <input id="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="edit-description" className="font-semibold block mb-2">Description</label>
                        <textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                    {/* Attachments Section */}
                    <div>
                        <label className="font-semibold block mb-2">Attachments</label>
                        <div className="p-4 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600">
                           {attachments.length > 0 && (
                               <ul className="space-y-2 mb-4">
                                   {attachments.map((file, index) => (
                                       <li key={index} className="flex justify-between items-center bg-gray-100 dark:bg-gray-600 p-2 rounded">
                                           <span className="text-sm truncate">{file.name}</span>
                                           <button type="button" onClick={() => handleRemoveAttachment(index)} className="text-red-500 hover:text-red-700 font-bold ml-4">X</button>
                                       </li>
                                   ))}
                               </ul>
                           )}
                           <input type="file" id="file-upload" multiple onChange={handleFileChange} className="hidden" />
                           <label htmlFor="file-upload" className="w-full text-center cursor-pointer bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover block">
                               Upload Files
                           </label>
                        </div>
                        {attachments.length > 0 && (
                            <button
                                type="button"
                                onClick={handleAnalyzeAttachments}
                                disabled={isAnalyzing}
                                className="w-full mt-4 px-4 py-2 bg-secondary text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isAnalyzing ? 'Analyzing...' : '✨ Analyze Attachments'}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="edit-points" className="font-semibold block mb-2">Story Points (Optional)</label>
                            <input id="edit-points" type="number" value={points} onChange={(e) => setPoints(e.target.value === '' ? '' : parseInt(e.target.value, 10))} min="0" className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                        </div>
                        <div>
                             <label htmlFor="edit-status" className="font-semibold block mb-2">Status</label>
                             <select id="edit-status" value={column} onChange={(e) => setColumn(e.target.value as ColumnId)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-[42px]">
                                {COLUMNS.map(col => (
                                    <option key={col.id} value={col.id}>{col.title}</option>
                                ))}
                             </select>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                            aria-label="Delete task"
                        >
                            Delete Task
                        </button>
                        <div className="space-x-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover">Save Changes</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SprintEditModal: React.FC<{
    sprint: Sprint;
    onClose: () => void;
    onSave: (updatedSprint: Sprint) => void;
}> = ({ sprint, onClose, onSave }) => {
    const [name, setName] = useState(sprint.name);
    const [goal, setGoal] = useState(sprint.goal);
    const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(formatDateForInput(sprint.startDate));
    const [endDate, setEndDate] = useState(formatDateForInput(sprint.endDate));

    const handleSubmit = () => {
        if (!name.trim() || !goal.trim() || !startDate || !endDate) {
            alert('Please fill in all fields.');
            return;
        }
        if (new Date(startDate) >= new Date(endDate)) {
            alert('The start date must be before the end date.');
            return;
        }
        onSave({
            ...sprint,
            name,
            goal,
            startDate: new Date(startDate + 'T00:00:00Z'),
            endDate: new Date(endDate + 'T00:00:00Z'),
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-lg text-gray-800 dark:text-gray-100">
                <h2 className="text-2xl font-bold mb-6">Edit Sprint Details</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                    <div>
                        <label htmlFor="sprint-name" className="font-semibold block mb-2">Sprint Name</label>
                        <input id="sprint-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="sprint-goal" className="font-semibold block mb-2">Sprint Goal</label>
                        <textarea id="sprint-goal" value={goal} onChange={(e) => setGoal(e.target.value)} required rows={3} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="start-date" className="font-semibold block mb-2">Start Date</label>
                            <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                        </div>
                        <div>
                             <label htmlFor="end-date" className="font-semibold block mb-2">End Date</label>
                             <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const GenerateStoriesModal: React.FC<{
    onClose: () => void;
    onGenerate: (featureIdea: string) => void;
}> = ({ onClose, onGenerate }) => {
    const [featureIdea, setFeatureIdea] = useState('');

    const handleSubmit = () => {
        if (!featureIdea.trim()) {
            alert('Please enter a feature idea.');
            return;
        }
        onGenerate(featureIdea);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-lg text-gray-800 dark:text-gray-100">
                <h2 className="text-2xl font-bold mb-6">✨ Generate User Stories with AI</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                    <div>
                        <label htmlFor="feature-idea" className="font-semibold block mb-2">High-Level Feature Idea</label>
                        <input 
                            id="feature-idea" 
                            type="text" 
                            value={featureIdea} 
                            onChange={(e) => setFeatureIdea(e.target.value)} 
                            placeholder="e.g., 'A dashboard for project analytics'"
                            required 
                            className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                        />
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded bg-secondary text-white hover:bg-green-600">Generate Stories</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [sprint, setSprint] = useState<Sprint>(initialSprint);
  const [isLoading, setIsLoading] = useState(false);
  const [aiFeature, setAiFeature] = useState<'stories' | 'summary' | null>(null);
  const [aiGeneratedContent, setAiGeneratedContent] = useState<string>('');
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [showStoriesModal, setShowStoriesModal] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const moveTask = useCallback((taskId: string, targetColumn: ColumnId) => {
    setTasks(
      produce(draft => {
        const task = draft.find(t => t.id === taskId);
        if (task) {
          task.column = targetColumn;
        }
      })
    );
  }, []);

  const handleAddTask = useCallback((taskData: { title: string; description: string; points?: number; }) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      column: 'backlog',
      attachments: [],
      ...taskData
    };
    setTasks(
      produce(draft => {
        draft.push(newTask);
      })
    );
    setShowNewTaskModal(false);
  }, []);

    const handleUpdateTask = useCallback((updatedTask: Task) => {
        setTasks(produce(draft => {
            const taskIndex = draft.findIndex(t => t.id === updatedTask.id);
            if (taskIndex !== -1) {
                draft[taskIndex] = updatedTask;
            }
        }));
        setEditingTask(null);
    }, []);
    
    const handleDeleteTask = useCallback((taskId: string) => {
        setTasks(produce(draft => {
            const taskIndex = draft.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                draft.splice(taskIndex, 1);
            }
        }));
        setEditingTask(null);
    }, []);

    const handleOpenTaskDetails = (task: Task) => {
        setEditingTask(task);
    };

    const handleUpdateSprint = useCallback((updatedSprint: Sprint) => {
        setSprint(updatedSprint);
        setShowSprintModal(false);
    }, []);

  const handleGenerateStories = async (featureIdea: string) => {
    if (!featureIdea) return;
    
    setShowStoriesModal(false);
    setIsLoading(true);
    setAiFeature('stories');
    try {
        const newStories = await generateUserStories(featureIdea);
        setTasks(prev => [...prev, ...newStories.map((story, index) => ({
            ...story,
            id: `task-${Date.now()}-${index}`,
            column: 'backlog' as ColumnId,
            attachments: [],
        }))]);
    } catch (error) {
        console.error("Failed to generate user stories:", error);
        alert("Error generating user stories. Check console for details.");
    } finally {
        setIsLoading(false);
        setAiFeature(null);
    }
};
  
  const tasksByColumn = useMemo(() => {
    return tasks.reduce((acc, task) => {
      if (!acc[task.column]) {
        acc[task.column] = [];
      }
      acc[task.column].push(task);
      return acc;
    }, {} as Record<ColumnId, Task[]>);
  }, [tasks]);

  const sprintDurationDays = useMemo(() => {
    const diffTime = Math.abs(sprint.endDate.getTime() - sprint.startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [sprint.startDate, sprint.endDate]);

  const burndownData = useMemo(() => {
    const sprintTasks = tasks.filter(t => t.column !== 'backlog');
    const totalPoints = sprintTasks.reduce((sum, task) => sum + (task.points || 0), 0);
    const data = [{ day: 0, remaining: totalPoints, ideal: totalPoints }];
    
    const pointsPerDay = totalPoints > 0 && sprintDurationDays > 0 ? totalPoints / sprintDurationDays : 0;

    for (let i = 1; i <= sprintDurationDays; i++) {
        const date = new Date(sprint.startDate);
        date.setDate(date.getDate() + i);
        // This is a simulation - in a real app, you'd track completion dates.
        const completedPoints = tasks.filter(t => t.column === 'done').reduce((sum, task) => sum + (task.points || 0), 0);
        data.push({
            day: i,
            remaining: totalPoints - completedPoints,
            ideal: Math.max(0, Math.round((totalPoints - (pointsPerDay * i)) * 10) / 10),
        });
    }
    return data;
  }, [tasks, sprint.startDate, sprint.endDate, sprintDurationDays]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-light dark:bg-dark text-dark dark:text-light font-sans">
        <header className="bg-white dark:bg-gray-900 shadow-md p-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">Scrum Sprint Runner</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary bg-gray-200 dark:bg-gray-700"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button onClick={() => setShowStoriesModal(true)} className="px-4 py-2 bg-secondary text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors">
              ✨ AI Generate Stories
            </button>
            <button onClick={() => setShowRetroModal(true)} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover transition-colors">
              🚀 Run Retrospective
            </button>
          </div>
        </header>
        
        <main className="p-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg mb-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{sprint.name}</h2>
                <button 
                    onClick={() => setShowSprintModal(true)}
                    className="text-sm px-3 py-1 border border-primary text-primary rounded-md hover:bg-primary hover:text-white transition-colors"
                >
                    Edit
                </button>
            </div>
            <p className="text-medium mt-1">{sprint.goal}</p>
            <div className="text-sm text-medium mt-2">
              <span>{sprint.startDate.toLocaleDateString()}</span> - <span>{sprint.endDate.toLocaleDateString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
             <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Sprint Burndown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={burndownData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568"/>
                    <XAxis dataKey="day" label={{ value: 'Sprint Day', position: 'insideBottom', offset: -5 }} stroke="#a0aec0"/>
                    <YAxis label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }} stroke="#a0aec0"/>
                    <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: 'none' }}/>
                    <Legend />
                    <Bar dataKey="remaining" fill="#4f46e5" name="Remaining Work"/>
                    <Bar dataKey="ideal" fill="#6b7280" name="Ideal Burn"/>
                  </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">AI Retrospective Summary</h3>
                 {isLoading && aiFeature === 'summary' ? (
                     <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div></div>
                 ) : aiGeneratedContent ? (
                     <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{aiGeneratedContent}</div>
                 ) : (
                    <p className="text-medium">Run a retrospective to generate an AI summary of action items.</p>
                 )}
             </div>
          </div>
          
          <div className="flex gap-6">
            {COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByColumn[column.id] || []}
                moveTask={moveTask}
                onAddTaskClick={column.id === 'backlog' ? () => setShowNewTaskModal(true) : undefined}
                onTaskClick={handleOpenTaskDetails}
              />
            ))}
          </div>
        </main>

        {isLoading && !aiFeature && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-white mb-4"></div>
                    <p className="text-white text-lg">AI is thinking...</p>
                </div>
            </div>
        )}
        
        {showRetroModal && (
            <RetrospectiveModal 
                onClose={() => setShowRetroModal(false)}
                setSummary={setAiGeneratedContent}
                setIsLoading={(loading) => {
                    setIsLoading(loading);
                    setAiFeature(loading ? 'summary' : null);
                }}
            />
        )}

        {showNewTaskModal && (
            <NewTaskModal 
                onClose={() => setShowNewTaskModal(false)}
                onAddTask={handleAddTask}
            />
        )}

        {editingTask && (
            <TaskDetailModal
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={handleUpdateTask}
                onDelete={handleDeleteTask}
            />
        )}

        {showSprintModal && (
            <SprintEditModal
                sprint={sprint}
                onClose={() => setShowSprintModal(false)}
                onSave={handleUpdateSprint}
            />
        )}

        {showStoriesModal && (
            <GenerateStoriesModal
                onClose={() => setShowStoriesModal(false)}
                onGenerate={handleGenerateStories}
            />
        )}
      </div>
    </DndProvider>
  );
};

export default App;