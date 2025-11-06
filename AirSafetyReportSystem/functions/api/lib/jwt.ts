/**
 * Secure JWT implementation using Web Crypto API for Cloudflare Workers
 * This provides signed JWT tokens to prevent token forgery
 */

const base64UrlEncode = (str: string): string => {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const base64UrlDecode = (str: string): string => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
};

/**
 * Generate a secure JWT token with HMAC-SHA256 signature
 */
export async function signJWT(payload: Record<string, any>, secret: string): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Add expiration (7 days from now)
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  const fullPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const data = `${encodedHeader}.${encodedPayload}`;

  // Create HMAC key from secret
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(data)
  );

  // Convert signature to base64url
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  const encodedSignature = base64UrlEncode(signatureBase64);

  return `${data}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    if (!secret || secret.length < 32) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Verify signature
    const data = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature
    const signatureBase64 = base64UrlDecode(encodedSignature);
    const signatureBytes = Uint8Array.from(
      atob(signatureBase64),
      (c) => c.charCodeAt(0)
    );

    // Verify signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes,
      encoder.encode(data)
    );

    if (!isValid) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Decode JWT payload without verification (for backward compatibility during migration)
 * WARNING: Only use for migration. New code should use verifyJWT.
 */
export function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

