export type BudgetItem = { key: string; tokens: number; priority: number; required?: boolean };
export function fitToBudget(items: BudgetItem[], limit: number) {
  const keep = new Set<string>(); const trimmed: string[] = [];
  let used = 0;
  for (const it of items.filter((i) => i.required)) { keep.add(it.key); used += it.tokens; }
  for (const it of items.filter((i) => !i.required).sort((a, b) => b.priority - a.priority)) {
    if (used + it.tokens <= limit) { keep.add(it.key); used += it.tokens; } else trimmed.push(it.key);
  }
  return { keep, used, trimmed };
}
