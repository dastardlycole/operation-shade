import productsData from "@/data/products.json";
import rulesData from "@/data/rules.json";
import type { Product, Rule, Session } from "./types";

const products = productsData as Product[];
const rules = rulesData as Rule[];

export interface VerdictResult {
  products: Product[];
  declinedProducts: Product[];
  budgetNote?: string;
  fragranceWarning?: boolean;
}

export function route(session: Partial<Session>): VerdictResult | null {
  if (!session.skin || !session.budget) return null;
  if (session.skin === "not-sure") return null;

  const rule = rules.find(
    (r) =>
      r.active &&
      r.conditions.skin === session.skin &&
      r.conditions.budget === session.budget
  );

  if (!rule) return null;

  const verdictProducts = rule.productRefs
    .map((ref) => products.find((p) => p.ref === ref))
    .filter((p): p is Product => p !== undefined);

  // Glass Drop (endorsed: false) shown as declined when budget covers it
  const declinedProducts =
    session.budget === "60-plus" ? products.filter((p) => !p.endorsed) : [];

  return {
    products: verdictProducts,
    declinedProducts,
    budgetNote: rule.budgetNote,
    fragranceWarning: rule.fragranceWarning,
  };
}
