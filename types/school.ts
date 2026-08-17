export interface School {
  id: string;
  name: string;
  abbreviation: string;
  /** Whether the platform owner has opened this school for public registration. */
  registration_enabled?: boolean;
}

export type LoginFieldErrors = {
  email?: string;
  password?: string;
  school?: string;
  form?: string;
};
