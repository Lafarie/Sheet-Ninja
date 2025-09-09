import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here';
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

export function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}
