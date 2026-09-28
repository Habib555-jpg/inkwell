import type { ContextPack, VoiceCard } from '@/server/memory/types';

export const voice = (o: Partial<VoiceCard> = {}): VoiceCard => ({ register: 'casual', sentenceLength: 'short', emotionalBaseline: 'even', verbalTics: ['Figures'], avoid: ['indeed'], sampleLines: [{ quote: 'Figures.', chapterNumber: 2 }], relationshipRegisters: [], userVoiceNotes: 'sarcastic', forming: false, lineCount: 12, ...o });
export const samplePack = (): ContextPack => ({
  novel: { id: 'n', title: 'The Ashen Crown', genre: 'Fantasy', premise: 'p', setting: 's', writingStyle: 'wry', tone: 'tense', rulesText: '', pov: 'third_limited', tense: 'past', dialogueBalance: 'balanced', targetWords: 2000 },
  chapter: { id: 'c', number: 25, title: 'The Key', mainIdea: 'Mira returns for the key', requiredEvents: ['Mira retrieves the Starlight Key', 'Bram follows her'], forbiddenEvents: ['Mira dies'], characterIds: ['m'], tone: 'tense', dialoguePoints: ['Mira says "I do not trust you, Bram"'], restrictions: '', targetWords: null, instructions: '' },
  characters: [
    { id: 'm', name: 'Mira Vale', aliases: ['Mira'], role: '', personality: 'wry', goals: '', fears: '', motivations: '', abilities: '', weaknesses: '', speechStyle: '', vocabulary: '', developmentNotes: '', currentStatus: '', currentLocation: "Gull's Rest", voice: voice(), recentEvents: [] },
    { id: 'b', name: 'Bram Holt', aliases: ['Bram'], role: '', personality: 'formal', goals: '', fears: '', motivations: '', abilities: '', weaknesses: '', speechStyle: '', vocabulary: '', developmentNotes: '', currentStatus: '', currentLocation: null, voice: voice({ register: 'formal', verbalTics: [], avoid: [], sampleLines: [{ quote: 'I do not believe that is wise.', chapterNumber: 1 }] }), recentEvents: [] },
  ],
  relationships: [{ fromName: 'Mira Vale', toName: 'Bram Holt', type: 'distrusts', description: '', isSecret: false }],
  timeline: [{ chapterNumber: 2, description: 'Mira hid the Starlight Key.' }],
  recentChapters: [{ number: 24, title: 'Dusk', summary: 'Cass waited.', tail: 'The lanterns guttered.' }],
  retrieved: [{ chunkId: 'k', chapterNumber: 2, content: 'Mira hid the Starlight Key beneath the old lighthouse.', score: 0.9 }],
  world: [{ kind: 'location', name: "Gull's Rest", description: 'Fishing village' }],
  preferences: [{ scope: 'global', statement: 'Keep dialogue informal.' }],
  budget: { limit: 6000, used: 900, trimmed: [] }, included: [],
});
