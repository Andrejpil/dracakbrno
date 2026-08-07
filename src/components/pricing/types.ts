export interface PriceLocationType {
  id: string;
  world_id: string;
  code: string;
  label: string;
  default_modifier_pct: number;
  sort_order: number;
}

export interface PriceLocation {
  id: string;
  world_id: string;
  name: string;
  code: string | null;
  type: string;
  type_code: string | null;
  uses_type_default: boolean;
  price_modifier_pct: number;
  note: string | null;
  size: number | null;
  wealth: number | null;
  region: string | null;
}

export interface PriceItem {
  id: string;
  world_id: string;
  name: string;
  code: string | null;
  category: string | null;
  category_id: string | null;
  unit: string | null;
  note: string | null;
  base_price_copper: number;
  availability_mode: string;
  availability_profile_id: string | null;
}

export interface PriceItemLocation {
  id: string;
  item_id: string;
  location_id: string;
  override_modifier_pct: number | null;
}

export interface SettlementTag {
  id: string;
  world_id: string;
  code: string;
  label: string;
  sort_order: number;
}

export interface SettlementTagLink {
  world_id: string;
  location_id: string;
  tag_id: string;
}

export interface AvailabilityProfile {
  id: string;
  world_id: string;
  code: string;
  name: string;
  note: string | null;
  rules: ProfileRules;
}

export interface ProfileRules {
  type_codes?: string[];
  tags_any?: string[];
  tags_all?: string[];
  tags_none?: string[];
  size_min?: number | null;
  size_max?: number | null;
  wealth_min?: number | null;
  wealth_max?: number | null;
  regions_in?: string[];
  regions_not_in?: string[];
}

export interface PriceCategory {
  id: string;
  world_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  default_profile_id: string | null;
  sort_order: number;
}

export interface ItemException {
  id: string;
  world_id: string;
  item_id: string;
  location_id: string;
  action: 'ALLOW' | 'DENY';
}
