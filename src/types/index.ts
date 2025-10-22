export type Client = {
  id?: string;
  name: string;
};

export type ApiKey = {
  id?: string;
  client_id?: string;
  prefix: string;
  hashed_key: string;
  name?: string;
  active?: boolean;
};

export type User = {
  id?: string;
  name: string;
  email: string;
  client_id: string;
};

export type Content = {
  id?: string;
  project_id: string;
  media_type: string;
  media_url: string;
  text_content: string;
};

export type Project = {
  id?: string;
  user_id: string;
  theme_id: string;
  client_id: string;
  name: string;
  description: string;
  goals: string;
  customer_type: string;
};

export type Theme = {
  id?: string;
  user_id: string;
  name: string;
  font: string;
  tags: string[];
  inspirations: string[];
};

export type Embedding = {
  id?: string;
  content_id: string;
  embedding: number[];
  text_content: string;
  created_at?: string;
};
