/**
 * Developer tool: creates a demo account with a 6-chapter novel, driven through the same
 * services the app uses (generate → feedback → revise → author's final text → approve).
 * The application itself contains no hard-coded novel data.
 * Usage: npm run db:seed   (idempotent — exits if the demo account exists)
 */
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { loadEnv } from '../src/server/env';
import { createDb } from '../src/server/db/connect';
import { createProviders } from '../src/server/ai/registry';
import * as s from '../src/server/db/schema';
import { registerUser } from '../src/server/auth/service';
import { createNovel } from '../src/server/services/novels';
import { createCharacter } from '../src/server/services/characters';
import { createRelationship } from '../src/server/services/relationships';
import { createWorldEntity } from '../src/server/services/world';
import { createChapter } from '../src/server/services/chapters';
import { autosaveVersion } from '../src/server/services/versions';
import { generateDraft } from '../src/server/pipeline/generate';
import { submitFeedback, updateProposalItems, applyProposal } from '../src/server/feedback/service';
import { approveVersion } from '../src/server/canon/approve';

const EMAIL = 'demo@inkwell.local';
const empty = { whatWorked: '', whatDidnt: '', changesRequested: '', charactersOk: '', dialogueNatural: '', followedInstructions: '', remove: '', add: '' };

const CHAPTERS: { title: string; mainIdea: string; required: string[]; forbidden: string[]; prose: string[]; feedback: Partial<typeof empty>; rating: number }[] = [
  { title: 'The Salt Road', mainIdea: 'Mira robs the customs house while Bram watches', required: ['Mira steals the ledger', 'Bram sees her and says nothing'], forbidden: ['Mira is caught'], rating: 7,
    feedback: { dialogueNatural: 'The dialogue is too formal.' },
    prose: ['Mira Vale cut the ledger free of its chain and slid it under her coat before the lamp finished guttering.', '“Figures,” Mira said. “Nobody guards the good stuff.”', 'Bram Holt stood in the doorway of the customs house and watched her go. “I do not approve of theft,” Bram said. “It is beneath us.”', 'Mira distrusts Bram. She did not say so, and he did not stop her.'] },
  { title: 'Gull’s Rest', mainIdea: 'Mira hides the Starlight Key', required: ['Mira hides the Starlight Key beneath the lighthouse'], forbidden: ['Bram finds the key'], rating: 8.5, feedback: { whatWorked: 'The lighthouse scene.' },
    prose: ['Mira reached Gull’s Rest after midnight, soaked and furious.', 'She climbed the cliff path to the old lighthouse and pried up the third flagstone. Mira hid the Starlight Key beneath the old lighthouse at Gull’s Rest, then pressed the stone back into place.', '“Nobody finds it but me,” Mira said. “Not even you, Bram.”'] },
  { title: 'Ash and Oaths', mainIdea: 'Bram swears an Ash Oath', required: ['Bram swears an oath over ash'], forbidden: [], rating: 6, feedback: { dialogueNatural: 'Dialogue too stiff again.', whatDidnt: 'In this chapter the ending dragged.' },
    prose: ['Bram knelt in the burned chapel and pressed his palm into the ash.', '“I swear it on the ash of my house,” Bram said. “I will see the crown returned.”', 'No one can break an Ash Oath without dying. Bram knew it, and swore anyway.'] },
  { title: 'The Grey Guild', mainIdea: 'Mira meets the broker Tovin Rask', required: ['Mira meets Tovin Rask'], forbidden: [], rating: 7.5, feedback: { dialogueNatural: 'Still too formal dialogue.' },
    prose: ['Mira arrived at Vey Harbor before dawn. The Grey Guild owned every pier.', '“You’re late,” Tovin Rask said. Tovin Rask was a broker for the Grey Guild.', '“Yeah, well. Tides,” Mira said.'] },
  { title: 'Knives at the Pier', mainIdea: 'The Guild strikes', required: ['The Guild attacks at the pier'], forbidden: ['Mira dies'], rating: 8, feedback: {},
    prose: ['The Guild’s knives came out of the fog.', '“Down!” Mira shouted, and Tovin Rask dragged her behind the crates.', 'It was revealed that Tovin Rask had been the informant all along.'] },
  { title: 'Return to the Light', mainIdea: 'Mira goes back for what she hid', required: ['Mira returns to Gull’s Rest'], forbidden: [], rating: 9, feedback: {},
    prose: ['Mira rode south for two days.', 'Mira returned to Gull’s Rest at dusk and stood a long time at the foot of the lighthouse.', '“Figures,” Mira said to no one. “Still here.”'] },
];

async function main() {
  const env = loadEnv();
  const db = await createDb(env);
  const [existing] = await db.select().from(s.users).where(eq(s.users.email, EMAIL));
  if (existing) { console.log(`Demo account ${EMAIL} already exists — nothing to do.`); process.exit(0); }
  const ctx = { db, ...createProviders({ ...env, AI_RATE_LIMIT_PER_MIN: 10_000 }) };
  const password = randomBytes(9).toString('base64url');
  const user = await registerUser(db, { email: EMAIL, password, name: 'Demo Writer' });
  const novel = await createNovel(db, user.id, { title: 'The Ashen Crown', genre: 'Dark fantasy', tone: 'tense, wry', premise: 'A thief inherits a cursed crown and a knight who wants it back.', writingStyle: 'Close third person, short chapters, dry humor', targetChapterWords: 1500 });
  const mira = await createCharacter(db, user.id, novel.id, { name: 'Mira Vale', aliases: ['Mira'], personality: 'wry, guarded thief', speechStyle: 'short, sarcastic, contractions', goals: 'free her brother' });
  const bram = await createCharacter(db, user.id, novel.id, { name: 'Bram Holt', aliases: ['Bram'], personality: 'formal former knight', speechStyle: 'formal, no contractions', fears: 'dishonor' });
  await createRelationship(db, user.id, novel.id, { fromCharacterId: mira.id, toCharacterId: bram.id, type: 'distrusts' });
  await createWorldEntity(db, user.id, novel.id, 'world_rule', { name: 'Ash Oath', category: 'magic', description: 'An oath sworn over ash binds the swearer until death.' });
  await createWorldEntity(db, user.id, novel.id, 'location', { name: 'Gull’s Rest', description: 'A fishing village with an old lighthouse.' });

  for (const [i, c] of CHAPTERS.entries()) {
    const ch = await createChapter(db, user.id, novel.id, { number: i + 1, title: c.title, mainIdea: c.mainIdea, requiredEvents: c.required, forbiddenEvents: c.forbidden, characterIds: [mira.id, bram.id] });
    const { version: gen } = await generateDraft(ctx, user.id, ch.id);
    const fb = await submitFeedback(ctx, user.id, { versionId: gen.id, rating: c.rating, answers: { ...empty, ...c.feedback } });
    const base = fb.proposal.items.length
      ? (await updateProposalItems(db, user.id, fb.proposal.id, fb.proposal.items.map((it) => ({ id: it.id, status: 'accepted' as const }))), await applyProposal(ctx, user.id, fb.proposal.id))
      : gen;
    const { version: final } = await autosaveVersion(db, user.id, base.id, c.prose.join('\n\n'));
    const r = await approveVersion(ctx, user.id, final.id);
    console.log(`Chapter ${i + 1} “${c.title}” approved — memory ${r.extractionStatus}`);
  }
  await createChapter(db, user.id, novel.id, { number: 7, title: 'What the Light Kept', mainIdea: 'Mira retrieves the Starlight Key, but someone followed her', requiredEvents: ['Mira retrieves the Starlight Key'], forbiddenEvents: ['Bram dies'], characterIds: [mira.id, bram.id] });
  console.log(`\nDemo ready. Sign in as ${EMAIL} with password: ${password}\n(Shown once — it is not stored anywhere in plain text.)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
