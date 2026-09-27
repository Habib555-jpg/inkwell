import bcrypt from 'bcryptjs';
const COST = process.env.NODE_ENV === 'test' ? 4 : 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
