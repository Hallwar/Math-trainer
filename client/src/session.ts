const STUDENT_KEY = "math_trainer_student";
const TEACHER_KEY = "math_trainer_teacher";
const TEMPLATES_KEY = "math_trainer_templates";

export interface SavedStudent {
  studentId: string;
  sessionId: string;
  username: string;
}

export interface SavedTeacher {
  sessionId: string;
  code: string;
  topicLabel: string;
  rounds: { type: "normal" | "demo"; topicId: string; goalTasks?: number }[];
  countdownMinutes?: number;
}

export function saveStudent(data: SavedStudent) {
  localStorage.setItem(STUDENT_KEY, JSON.stringify(data));
}

export function loadStudent(): SavedStudent | null {
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearStudent() {
  localStorage.removeItem(STUDENT_KEY);
}

export function saveTeacher(data: SavedTeacher) {
  localStorage.setItem(TEACHER_KEY, JSON.stringify(data));
}

export function loadTeacher(): SavedTeacher | null {
  try {
    const raw = localStorage.getItem(TEACHER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearTeacher() {
  localStorage.removeItem(TEACHER_KEY);
}

// ── Templates ─────────────────────────────────────────────────────────────────
export interface SessionTemplate {
  id: string;
  name: string;
  rounds: { type: "normal" | "demo"; topicId: string; goalTasks?: number }[];
  countdownMinutes?: number;
  createdAt: number;
}

export function loadTemplates(): SessionTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveTemplate(template: Omit<SessionTemplate, "id" | "createdAt">) {
  const templates = loadTemplates();
  templates.unshift({ ...template, id: Math.random().toString(36).slice(2), createdAt: Date.now() });
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string) {
  const templates = loadTemplates().filter((t) => t.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}
