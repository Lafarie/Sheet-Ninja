import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
}
const ALGORITHM = 'aes-256-cbc';

// Create a proper 32-byte key from the environment variable
function getEncryptionKey(): Buffer {
  if (ENCRYPTION_KEY.length === 64) {
    // If it's a 64-character hex string, parse it as hex
    try {
      return Buffer.from(ENCRYPTION_KEY, 'hex');
    } catch {
      // If parsing as hex fails, fall through to string method
    }
  }
  
  // Use the string directly, but ensure it's exactly 32 bytes
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'utf8');
  if (keyBuffer.length === 32) {
    return keyBuffer;
  } else if (keyBuffer.length < 32) {
    // Pad with zeros if too short
    const paddedKey = Buffer.alloc(32);
    keyBuffer.copy(paddedKey);
    return paddedKey;
  } else {
    // Truncate if too long
    return keyBuffer.subarray(0, 32);
  }
}

const KEY_BUFFER = getEncryptionKey();

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: any): any {
  // Be permissive: if input is falsy or not a string, return as-is
  if (!text || typeof text !== 'string') return text;

  // Expect format iv:encrypted. If it's not present, assume plaintext and return it.
  if (!text.includes(':')) return text;

  try {
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    if (!ivHex) return text; // malformed, return original

    const iv = Buffer.from(ivHex, 'hex');
    // IV must be 16 bytes for AES-256-CBC
    if (iv.length !== 16) {
      console.warn('decrypt: invalid IV length', iv.length);
      return text; // Not encrypted in expected format
    }

    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // Log and return original value to avoid crashing callers when encountering
    // legacy/plaintext values or unexpected formats.
    console.error('Decryption failed:', error);
    return text;
  }
}
