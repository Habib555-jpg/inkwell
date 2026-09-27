export type FieldDef = {
  name: string; label: string;
  kind: 'text' | 'textarea' | 'list' | 'number' | 'select' | 'multiselect' | 'checkbox';
  options?: { value: string; label: string }[]; placeholder?: string; wide?: boolean;
};
export const characterFields: FieldDef[] = [
  { name: 'name', label: 'Name', kind: 'text' },
  { name: 'aliases', label: 'Aliases', kind: 'list', placeholder: 'One per line' },
  { name: 'role', label: 'Role', kind: 'text' }, { name: 'age', label: 'Age', kind: 'text' },
  { name: 'appearance', label: 'Appearance', kind: 'textarea' }, { name: 'personality', label: 'Personality', kind: 'textarea' },
  { name: 'goals', label: 'Goals', kind: 'textarea' }, { name: 'fears', label: 'Fears', kind: 'textarea' },
  { name: 'motivations', label: 'Motivations', kind: 'textarea' }, { name: 'abilities', label: 'Abilities', kind: 'textarea' },
  { name: 'weaknesses', label: 'Weaknesses', kind: 'textarea' },
  { name: 'speechStyle', label: 'Speech style', kind: 'textarea', placeholder: 'Sentence length, formality, habits…' },
  { name: 'vocabulary', label: 'Vocabulary', kind: 'textarea', placeholder: 'Words they use / never use' },
  { name: 'developmentNotes', label: 'Development', kind: 'textarea' },
  { name: 'currentStatus', label: 'Current status', kind: 'text' },
];
export const worldFields: FieldDef[] = [
  { name: 'name', label: 'Name', kind: 'text' },
  { name: 'description', label: 'Description', kind: 'textarea', wide: true },
];
export const worldRuleFields: FieldDef[] = [
  ...worldFields.slice(0, 1),
  { name: 'category', label: 'Category', kind: 'select', options: ['magic', 'technology', 'history', 'rule', 'term', 'other'].map((v) => ({ value: v, label: v })) },
  worldFields[1],
];
