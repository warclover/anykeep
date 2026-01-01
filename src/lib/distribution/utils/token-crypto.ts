/**
 * OAuth Token 加密/解密工具
 *
 * @module distribution/utils/token-crypto
 * @description 使用 AES-256-GCM 加密存储敏感 Token
 */

// 加密密钥从环境变量获取
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || "";

/**
 * 验证加密密钥
 */
function validateKey(): void {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  }
}

/**
 * 将字符串转换为 CryptoKey
 */
async function getKey(): Promise<CryptoKey> {
  validateKey();
  const keyData = new TextEncoder().encode(ENCRYPTION_KEY.slice(0, 32));
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * 加密 Token
 *
 * @param plaintext - 明文 Token
 * @returns 加密后的字符串（Base64 编码，包含 IV）
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();

  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 加密
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  // 合并 IV 和密文
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Base64 编码
  return btoa(String.fromCharCode(...combined));
}

/**
 * 解密 Token
 *
 * @param encrypted - 加密的字符串（Base64 编码）
 * @returns 解密后的明文 Token
 */
export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getKey();

  // Base64 解码
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  // 分离 IV 和密文
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // 解密
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * 检查加密密钥是否配置
 */
export function isEncryptionConfigured(): boolean {
  return !!ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 32;
}
