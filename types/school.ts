export interface School {
  id: string;
  name: string;
  abbreviation: string;
}

export type LoginFieldErrors = {
  email?: string;
  password?: string;
  school?: string;
  form?: string;
};
