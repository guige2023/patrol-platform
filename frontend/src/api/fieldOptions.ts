import api from './client';

export interface OptionItem {
  value: string;
  label: string;
  sort_order: number;
}

export interface FieldOption {
  id: string;
  field_key: string;
  label: string;
  options: OptionItem[];
  sort_order: number;
}

export const getFieldOptions = () =>
  api.get('/field-options/').then(res => res.data);

export const getFieldOption = (fieldKey: string) =>
  api.get(`/field-options/${fieldKey}`).then(res => res.data);

export const createFieldOption = (data: { field_key: string; label: string; options: OptionItem[] }) =>
  api.post('/field-options/', data).then(res => res.data);

export const updateFieldOption = (fieldKey: string, data: { label?: string; options?: OptionItem[] }) =>
  api.put(`/field-options/${fieldKey}`, data).then(res => res.data);

export const deleteFieldOption = (fieldKey: string) =>
  api.delete(`/field-options/${fieldKey}`);
