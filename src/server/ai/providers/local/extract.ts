import type { ExtractedFacts, ExtractionInput } from '../../types';
import { buildNameRegex, escapeRe, nameAlternation, normalizeApostrophes, properNouns, splitSentences, tokenOverlap, words } from '../../../text/tokenize';
import { SPEECH_VERBS } from '../../../text/dialogue';
import { makeResolver } from '../../../canon/names';

const LOC_WORDS = /\b(City|Town|Village|Mountains?|River|Forest|Woods|Capital|Kingdom|Tower|Temple|Castle|Palace|Gate|Harbou?r|Port|Isle|Island|Valley|Lake|Sea|Bay|Rest|Hollow|Keep|Market|Square|Street|Road|Inn|Tavern|Library|Lighthouse|Desert|Plains|Fields|Hall|Quarter|Docks)\b/;
const FACTION_WORDS = /\b(Guild|Order|Clan|Sect|Church|Company|Brotherhood|Sisterhood|Council|Legion|Empire|Alliance|Syndicate|Circle|Court|Watch|Army|Cult|Society|Academy)\b|^House\s/;
const OBJECT_WORDS = /\b(Key|Sword|Blade|Crown|Ring|Amulet|Book|Tome|Map|Stone|Orb|Staff|Letter|Seal|Mask|Relic|Dagger|Shield|Chalice|Compass|Lantern)\b/;
const ACTOR_VERBS = `(?:${SPEECH_VERBS}|nodded|smiled|laughed|walked|turned|looked|shrugged|frowned|grinned|stood|sat|ran|was|had)`;
const EVENT_VERBS = /\b(discover\w*|reveal\w*|kill\w*|died|dies|met|meets|arriv\w*|fled|flees|betray\w*|promis\w*|learn\w*|found|finds|defeat\w*|escap\w*|confess\w*|attack\w*|join\w*|left|stole|steals|destroy\w*|rescu\w*|captur\w*|awaken\w*|swore|swears|married|lost|won|hid|hides|retriev\w*|kidnap\w*|stabb\w*|wound\w*|crown\w*|exil\w*|banish\w*)\b/i;
const MAJOR = /\b(kill\w*|died|dies|reveal\w*|betray\w*|confess\w*|destroy\w*|awaken\w*|crown\w*|exil\w*)\b/i;
const PROPER = `((?:\\p{Lu}[\\p{L}'’-]*)(?:\\s+(?:of\\s+(?:the\\s+)?)?\\p{Lu}[\\p{L}'’-]*)*)`;
const REL_PATTERNS: [RegExp, string][] = [
  [/\b(no longer trusts?|stopped trusting|distrusts?|distrusted|doubts?|doubted|suspects?|suspected)\b/i, 'distrusts'],
  [/\bsecretly (loves?|loved)\b/i, 'secretly loves'],
  [/\b(trusts?|trusted|relies on|relied on)\b/i, 'trusts'],
  [/\b(loves?|loved|adores?|adored)\b/i, 'loves'],
  [/\b(hates?|hated|despises?|despised|loathes?|loathed)\b/i, 'hates'],
  [/\bbetray(s|ed)?\b/i, 'betrayed'],
  [/\b(fears?|feared)\b/i, 'fears'],
  [/\b(serves?|served|swore (loyalty|fealty) to|sworn to)\b/i, 'serves'],
  [/\b(allied with|allies with|joined forces with)\b/i, 'allied with'],
  [/\b(rivals?|rivaled|competes? with)\b/i, 'rivals'],
  [/\b(mentors?|mentored|trains?|trained|teaches|taught)\b/i, 'mentors'],
  [/\b(protects?|protected|guards?|guarded)\b/i, 'protects'],
];
const RULE = /\b(no one|nobody|none)\s+(can|could|may)\b|\b(is|was)\s+forbidden\b|\bonly\s+[\p{L}\s]{1,30}\s+(can|could|may)\b|\bmust never\b|\b(magic|power|oaths?|spells?|curses?|runes?|mana|qi)\b[^.]*\b(requires?|costs?|demands?|binds?)\b/iu;
const MAGIC = /\b(magic|spell|curse|rune|mana|qi|oath|aether|enchant\w*)\b/i;
const REVEAL = /\b(revealed|the truth|was actually|all along|confessed that)\b/i;

export function extractFactsLocal(input: ExtractionInput): ExtractedFacts {
  const text = input.text;
  const sentences = splitSentences(text);
  const k = input.known;
  const knownAll = [...k.characters.flatMap((c) => [c.name, ...c.aliases, c.name.split(' ')[0]]), ...k.locations.map((x) => x.name), ...k.factions.map((x) => x.name), ...k.objects.map((x) => x.name), ...k.worldRules.map((x) => x.name)];
  const isKnown = (n: string) => knownAll.some((x) => normalizeApostrophes(x).toLowerCase() === normalizeApostrophes(n).toLowerCase().replace(/^the\s+/, ''));
  const out: ExtractedFacts = { characters: [], locations: [], factions: [], objects: [], worldRules: [], events: [], relationships: [], revelations: [] };

  // 1. classify unknown proper nouns
  const newChars: string[] = [];
  const taken = () => [...out.factions, ...out.objects, ...out.locations, ...out.characters].map((e) => e.name);
  for (const [name, info] of properNouns(text)) {
    if (isKnown(name) || knownAll.some((x) => x.includes(name) || name.includes(x))) continue;
    if (taken().some((x) => x.includes(name))) continue; // e.g. "Guild" once "Grey Guild" is classified
    const firstSentence = sentences.find((s) => s.includes(name)) ?? '';
    if (FACTION_WORDS.test(name)) out.factions.push({ name: name.replace(/^The\s+/, ''), description: firstSentence });
    else if (OBJECT_WORDS.test(name)) out.objects.push({ name: name.replace(/^The\s+/, ''), description: firstSentence });
    else if (LOC_WORDS.test(name)) out.locations.push({ name, description: firstSentence });
    else if (info.count >= 2 && new RegExp(`(?:${escapeRe(name)}\\s+${ACTOR_VERBS}\\b|\\b(?:${SPEECH_VERBS})\\s+${escapeRe(name)})`, 'u').test(text)) {
      out.characters.push({ name, description: firstSentence }); newChars.push(name);
    }
  }
  const castNames = [...k.characters.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases })), ...newChars.map((n) => ({ id: `new:${n}`, name: n, aliases: [] }))];
  const resolve = makeResolver(castNames, { firstNames: true });
  const allNames = castNames.flatMap((c) => [c.name, ...c.aliases, c.name.split(' ')[0]]);
  const nameRe = buildNameRegex(allNames);
  const canonical = (n: string) => resolve(n)?.name ?? n;
  const charOut = (name: string) => { let e = out.characters.find((c) => c.name === name); if (!e) { e = { name }; out.characters.push(e); } return e; };
  const alt = nameAlternation(allNames);
  const N = alt ? `(?<![\\p{L}])(${alt})(?![\\p{L}])` : '(?!)'; // capture group 1 = the name
  const locationNames = [...k.locations.map((l) => l.name), ...out.locations.map((l) => l.name)];

  for (const s of sentences) {
    // 2. state changes
    let m: RegExpMatchArray | null;
    if ((m = s.match(new RegExp(`${N}\\s+(?:died|was killed|was slain|perished|was murdered)`, 'u'))) || (m = s.match(new RegExp(`(?:killed|slew|murdered)\\s+${N}`, 'u')))) charOut(canonical(m[1])).status = 'dead';
    else if ((m = s.match(new RegExp(`${N}\\s+(?:was|is)\\s+(?:badly\\s+)?(?:wounded|injured|hurt)`, 'u')))) charOut(canonical(m[1])).status = 'injured';
    else if ((m = s.match(new RegExp(`${N}\\s+(?:was captured|was taken prisoner|was imprisoned|was arrested)`, 'u')))) charOut(canonical(m[1])).status = 'captured';
    const lm = s.match(new RegExp(`${N}\\s+(?:arrived at|arrived in|reached|returned to|entered|fled to|traveled to|travelled to|sailed to|rode to|went to|walked into|came to)\\s+(?:the\\s+)?${PROPER}`, 'u'));
    if (lm) {
      const loc = lm[2];
      charOut(canonical(lm[1])).locationName = loc;
      if (!locationNames.some((l) => normalizeApostrophes(l).toLowerCase() === normalizeApostrophes(loc).toLowerCase())) { out.locations.push({ name: loc }); locationNames.push(loc); }
    }
    // 3. relationships between ordered pairs
    if (nameRe) {
      const hits = [...s.matchAll(new RegExp(nameRe.source, 'gu'))].map((x) => ({ name: canonical(x[1]), start: x.index!, end: x.index! + x[0].length }));
      for (let a = 0; a < hits.length; a++) for (let b = a + 1; b < hits.length; b++) {
        if (hits[a].name === hits[b].name) continue;
        const between = s.slice(hits[a].end, hits[b].start);
        if (words(between).length > 6) continue;
        const rel = REL_PATTERNS.find(([re]) => re.test(between));
        if (rel && !out.relationships.some((r) => r.from === hits[a].name && r.to === hits[b].name && r.type === rel[1]))
          out.relationships.push({ from: hits[a].name, to: hits[b].name, type: rel[1], isSecret: /secret/i.test(s) || undefined, evidence: s });
      }
    }
    // 4. rules, events, revelations
    if (RULE.test(s) && !k.worldRules.some((r) => tokenOverlap(s, r.description) >= 0.6))
      out.worldRules.push({ name: words(s).slice(0, 6).join(' '), category: MAGIC.test(s) ? 'magic' : 'rule', description: s });
    const who = nameRe ? [...new Set([...s.matchAll(new RegExp(nameRe.source, 'gu'))].map((x) => canonical(x[1])))] : [];
    if (EVENT_VERBS.test(s) && who.length && out.events.length < 12)
      out.events.push({ description: s.length > 220 ? s.slice(0, 217) + '…' : s, characterNames: who, locationName: locationNames.find((l) => normalizeApostrophes(s).includes(normalizeApostrophes(l))), importance: MAJOR.test(s) ? 3 : 2 });
    if (REVEAL.test(s)) out.revelations.push(s);
  }
  return out;
}
