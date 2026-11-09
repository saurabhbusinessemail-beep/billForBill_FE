import type { ServiceMode } from '../../documents/documents.models';

export interface ProductUnit { key: string; name: string; symbol: string; dimension: string; factorToBase: string; conversionKind: 'standard' | 'product_specific'; active: boolean; source: 'manual' | 'open_food_facts'; sourceText?: string; }
export type CatalogKind = 'business-types' | 'products' | 'categories' | 'attributes' | 'units' | 'taxes';
export interface CatalogVariation {
  key: string;
  values: Record<string, string>;
  baseUnit: ProductUnit | null;
  additionalUnits: ProductUnit[];
  barcode?: string;
  gtin?: string;
  normalizedGtin?: string;
  mrp?: string | null;
}

export interface CatalogRecord {
  id: string;
  name: string;
  title?: string;
  brand?: string;
  businessId?: string | null;
  attributes?: string[];
  variations?: CatalogVariation[];
  type?: string;
  serviceMeasurement?: ServiceMode | null;
  code?: string;
  categoryIds?: string[];
  taxMode?: 'inherit' | 'specific';
  taxComponentIds?: string[];
  hasImage?: boolean;
  imageId?: string;
  canEditImage?: boolean;
  unitCount?: number;
  productCount?: number;
  taxCount?: number;
  productIds?: string[];
  parentId?: string | null;
  unitIds?: string[];
  description?: string;
  symbol?: string;
  dimension?: string;
  calculationType?: 'percentage' | 'fixed';
  value?: number;
  currency?: string;
  effectiveStart?: string;
  effectiveEnd?: string | null;
  jurisdiction?: string;
}

export interface CatalogResponse<T> { success: boolean; data: T; }
export interface CatalogDeleteImpact { id: string; affected: Array<{ label: string; count: number; action: string }>; businessCopyCount?: number; }
