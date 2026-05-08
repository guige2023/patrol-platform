// Common API types

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
}

// Error response types
export interface ValidationError {
  loc: string[];
  msg: string;
  type: string;
}

export interface ApiError {
  detail?: string | ValidationError[];
  message?: string;
  msg?: string;
}

// Common entity types
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface User extends BaseEntity {
  username: string;
  email?: string;
  full_name?: string;
  is_active?: boolean;
  role_ids?: string[];
  permissions?: string[];  // 合并所有角色的权限
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  permissions?: string[];
}

export interface Unit {
  id: string;
  name: string;
  code?: string;
  parent_id?: string;
  level?: number;
  sort_order?: number;
}

export interface Cadre {
  id: string;
  name: string;
  gender?: string;
  birth_date?: string;
  political_status?: string;
  education?: string;
  rank?: string;
  position?: string;
  category?: string;
  unit_id?: string;
  unit_name?: string;
}

export interface Plan {
  id: string;
  name: string;
  year?: number;
  status?: string;
}

export interface Group {
  id: string;
  name: string;
  plan_id: string;
  status?: string;
}

export interface Draft {
  id: string;
  title: string;
  category?: string;
  status?: string;
}

export interface Clue {
  id: string;
  title: string;
  status?: string;
  source?: string;
  category?: string;
}

export interface Rectification {
  id: string;
  title: string;
  status?: string;
  unit_id?: string;
}

export interface Knowledge {
  id: string;
  title: string;
  category?: string;
  content?: string;
}

export interface Document {
  id: string;
  title: string;
  type?: string;
}

export interface Progress {
  id: string;
  plan_id: string;
  week_number: number;
  report_date: string;
}

// Search types
export interface SearchParams {
  search?: string;
  page?: number;
  page_size?: number;
}

// Axios error type for catch blocks — re-export real axios AxiosError
export type { AxiosError } from 'axios';
