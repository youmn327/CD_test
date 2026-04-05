export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface Submission {
  member: string;
  problemId: string;
  problemName: string;
  code: string;
  date: string;
  image?: string | null;
  timestamp: string;
}
