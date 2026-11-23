export interface User {
  onboarding?: {
    required: boolean;
    version: number;
    step: number;
    status: string;
  };
  id: string;
  displayName: string;
  username: string;
  email: string;
  role: "PLAYER" | "ORGANIZER" | "MODERATOR" | "SUPER_ADMIN";
  bio: string;
  visibility: string;
  emailVerified: boolean;
  createdAt: string;
  deletionRequestedAt?: string;
}
export interface Quiz {
  pricing: Pricing;
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  cover: string;
  questionCount: number;
  duration: number;
  status: string;
  visibility: string;
  ownerId: string;
}
export interface Question {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  seconds: number;
  image?: string;
  correct?: number[];
  explanation?: string;
  acceptedText?: string[];
  submitted?: { selected: number[]; text?: string; correct: boolean };
}
export interface Attempt {
  billing?: Pricing & { transactionId?: string };
  id: string;
  quizId: string;
  title: string;
  status: string;
  index: number;
  total: number;
  deadline: string;
  serverTime: number;
  score: number;
  correctCount: number;
  accuracy: number;
  elapsedMs: number;
  question?: Question;
  review?: Question[];
}
export interface Room {
  pricing: Pricing;
  paidEntriesEnabled: boolean;
  id: string;
  title: string;
  description: string;
  code: string;
  status: string;
  capacity: number;
  startsAt: string;
  participantCount: number;
  hostId: string;
  index: number;
  total: number;
  deadline: string;
  serverTime: number;
  sequence: number;
  joined: boolean;
  submitted: boolean;
  isHost: boolean;
  sample?: boolean;
  question?: Question;
  leaderboard: {
    rank: number;
    userId: string;
    displayName: string;
    username: string;
    score: number;
    correctCount: number;
    elapsedMs: number;
  }[];
}
export interface Pricing {
  accessType: string;
  coinPrice: number;
  includedAttempts: number;
  previewQuestions: number;
  available: boolean;
  version: number;
}
