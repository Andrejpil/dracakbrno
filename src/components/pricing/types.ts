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
}

export interface PriceItem {
  id: string;
  world_id: string;
  name: string;
  code: string | null;
  category: string | null;
  unit: string | null;
  note: string | null;
  base_price_copper: number;
  availability_mode: string;
}

export interface PriceItemLocation {
  id: string;
  item_id: string;
  location_id: string;
  override_modifier_pct: number | null;
}
