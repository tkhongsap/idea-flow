export interface RawIdea {
  id: string;
  content: string;
  timestamp: string;
  sourceType: 'text' | 'voice';
  tags?: string[];
}

export interface IdeaAtom {
  id: string;
  content: string;
  sourceIdeaId: string;
}

export interface Theme {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  ideaAtoms: IdeaAtom[];
  actionItems: string[];
  questions: string[];
  isUserCreated?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}