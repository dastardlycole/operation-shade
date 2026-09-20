import type { Person } from "./types";

export function score(p: Person): number {
  return (
    p.saves * 3 +
    p.shares * 5 +
    p.returns * 2 +
    (p.order > 0 ? 10 : 0)
  );
}

export function sortByBehaviour(people: Person[]): Person[] {
  return [...people].sort((a, b) => score(b) - score(a));
}
