export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new SyntaxError('No JSON found');
  const end = body.lastIndexOf(body[start] === '{' ? '}' : ']');
  return JSON.parse(body.slice(start, end + 1));
}
