export type SkinType = "dry" | "oily" | "sensitive" | "redness" | "not-sure";
export type Budget = "under-30" | "30-60" | "60-plus";
export type Finish = "rich" | "light" | "glow" | "invisible";
export type Routine = "nothing" | "cleanser-only" | "full-routine";

export interface Session {
  skin: string | null;
  routine: string | null;
  budget: string | null;
  finish: string | null;
}

export interface Product {
  ref: string;
  name: string;
  price: number;
  type: string;
  skin: string[];
  finish: string;
  rating: number;
  note: string;
  endorsed: boolean;
}

export interface Rule {
  id: string;
  conditions: { skin: string; budget: string };
  productRefs: string[];
  budgetNote?: string;
  fragranceWarning?: boolean;
  source: "seed" | "promoted";
  active: boolean;
}

export interface Question {
  id: string;
  order: number;
  prompt: string;
  options: { value: string; label: string }[];
}

export interface Intercept {
  id: string;
  handle: string;
  type: string;
  message: string;
  routingPath: { skin: string | null; budget: string | null; finish: string | null } | null;
  previousAnswer: string | null;
}

export interface Person {
  handle: string;
  dms: number;
  saves: number;
  shares: number;
  returns: number;
  bought: boolean;
  order: number;
}
