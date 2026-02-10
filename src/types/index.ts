export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface AudioClip {
  id: string;
  name: string;
  path: string;
  duration: number;
  startTime: number;
}

export interface VideoClip {
  id: string;
  name: string;
  path: string;
  duration: number;
  startTime: number;
  thumbnail?: string;
}

export interface VideoScene {
  id: string;
  description: string;
  duration: number;
  scriptExcerpt: string;
}
