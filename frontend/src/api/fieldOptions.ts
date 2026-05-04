import api from './client';

export interface OptionItem {
  value: string;
  label: string;
  sort_order: number;
}

export interface FieldOption {
  id: string;
  field_key: string;
  entity_type: string;
  column_name: string;
  data_type: string;
  label: string;
  options: OptionItem[];
  sort_order: number;
  is_editable: boolean;
  is_required: boolean;
  is_visible: boolean;
  is_picklist: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FieldOptionSummary {
  id: string;
  field_key: string;
  entity_type: string;
  column_name: string;
  data_type: string;
  label: string;
  sort_order: number;
  is_editable: boolean;
  is_required: boolean;
  is_visible: boolean;
  is_picklist: boolean;
}

export interface DiscoveredField {
  column_name: string;
  data_type: string;
  field_key: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  skipped: number;
  new_fields: string[];
}

// 获取所有字段配置
export const getFieldOptions = () =>
  api.get('/field-options/').then(res => res.data);

// 按 entity_type 获取字段列表（不含options，列表用）
export const getFieldsByEntity = (entityType: string) =>
  api.get(`/field-options/by-entity/${entityType}`).then(res => res.data);

// 获取所有已有配置的 entity_type
export const getEntityTypes = () =>
  api.get('/field-options/entity-types').then(res => res.data);

// 从数据库发现某 entity 的未配置字段
export const discoverFields = (entityType: string) =>
  api.get(`/field-options/discover/${entityType}`).then(res => res.data);

// 同步/批量导入发现的新字段
export const syncFields = (entityType: string, fields: DiscoveredField[]) =>
  api.post(`/field-options/sync/${entityType}`, fields).then(res => res.data);

// 获取单个字段完整配置（含options）
export const getFieldOption = (fieldKey: string) =>
  api.get(`/field-options/detail/${fieldKey}/`).then(res => res.data);

// 更新字段配置
export const updateFieldOption = (
  fieldKey: string,
  data: {
    label?: string;
    options?: OptionItem[];
    sort_order?: number;
    is_editable?: boolean;
    is_required?: boolean;
    is_visible?: boolean;
    is_picklist?: boolean;
  }
) => api.put(`/field-options/${fieldKey}/`, data).then(res => res.data);

// 删除字段配置
export const deleteFieldOption = (fieldKey: string) =>
  api.delete(`/field-options/${fieldKey}/`);
