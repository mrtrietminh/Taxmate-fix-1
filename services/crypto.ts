/**
 * Crypto utilities for password hashing and data encryption
 * Uses Web Crypto API (available in all modern browsers)
 */

// Salt for password hashing (in production, use unique salt per user stored in DB)
const HASH_ITERATIONS = 100000;
const HASH_LENGTH = 256;

/**
 * Hash a password using PBKDF2 with SHA-256
 * This is a secure one-way hash - cannot be reversed
 */
export async function hashPassword(password: string, salt?: string): Promise<string> {
    const encoder = new TextEncoder();

    // Generate or use provided salt
    const saltValue = salt || crypto.randomUUID();
    const saltBuffer = encoder.encode(saltValue);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    // Derive bits using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: HASH_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        HASH_LENGTH
    );

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(derivedBits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Return salt:hash format
    return `${saltValue}:${hashHex}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Handle legacy plaintext passwords (6 digit PINs without ':')
    if (!storedHash.includes(':')) {
        // This is a legacy plaintext password - compare directly
        // After successful login, the password should be migrated to hashed version
        return password === storedHash;
    }

    const [salt] = storedHash.split(':');
    const newHash = await hashPassword(password, salt);
    return newHash === storedHash;
}

/**
 * Check if a password is already hashed (contains salt:hash format)
 */
export function isPasswordHashed(password: string): boolean {
    return password.includes(':') && password.length > 50;
}

// Encryption key derivation for backup encryption
const ENCRYPTION_KEY = 'taxmate-backup-v1'; // In production, derive from user password

/**
 * Encrypt data using AES-GCM
 */
export async function encryptData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(ENCRYPTION_KEY),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('taxmate-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(encryptedData: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    // Derive key
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(ENCRYPTION_KEY),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('taxmate-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    return decoder.decode(decryptedBuffer);
}

/**
 * Check if data is encrypted (starts with expected format)
 */
export function isEncrypted(data: string): boolean {
    try {
        // Encrypted data is base64 and at least 12 bytes (IV) + some data
        const decoded = atob(data);
        return decoded.length > 12;
    } catch {
        return false;
    }
}
