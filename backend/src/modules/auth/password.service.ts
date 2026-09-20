import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * scrypt from the Node standard library rather than argon2 or bcrypt.
 *
 * Both of those are native modules, and a native build step is a real cost on a
 * three-person team shipping from Windows laptops to Linux containers. scrypt
 * with these parameters is a memory-hard KDF in its own right, and email/password
 * is the secondary login path anyway — phone OTP is how almost everyone signs in.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
  }

  /** Constant-time, and returns false rather than throwing on a malformed hash. */
  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');

    const derived = await scryptAsync(password, salt, expected.length, {
      N: Number.parseInt(n, 10),
      r: Number.parseInt(r, 10),
      p: Number.parseInt(p, 10),
      maxmem: PARAMS.maxmem,
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
