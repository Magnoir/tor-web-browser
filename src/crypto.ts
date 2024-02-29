import { webcrypto } from "crypto";

const iv = webcrypto.getRandomValues(new Uint8Array(16));
// #############
// ### Utils ###
// #############

// Function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

// Generates a pair of private / public RSA keys
type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};
export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  // TODO implement this function using the crypto package to generate a public and private RSA key pair.
  //      the public key should be used for encryption and the private key for decryption. Make sure the
  //      keys are extractable.

  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

// Export a crypto public key to a base64 string format
export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  // TODO implement this function to return a base64 string version of a public key

  // remove this
  return arrayBufferToBase64(await webcrypto.subtle.exportKey("spki", key));
}

// Export a crypto private key to a base64 string format
export async function exportPrvKey(
  key: webcrypto.CryptoKey | null
): Promise<string | null> {
  // TODO implement this function to return a base64 string version of a private key

  // remove this
  return key ? arrayBufferToBase64(await webcrypto.subtle.exportKey("pkcs8", key)) : null;
}

// Import a base64 string public key to its native format
export async function importPubKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  // TODO implement this function to go back from the result of the exportPubKey function to it's native crypto key object

  return webcrypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(strKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

// Import a base64 string private key to its native format
export async function importPrvKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  // TODO implement this function to go back from the result of the exportPrvKey function to it's native crypto key object

  return webcrypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(strKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
}

// Encrypt a message using an RSA public key
export async function rsaEncrypt(
  b64Data: string,
  strPublicKey: string
): Promise<string> {
  // TODO implement this function to encrypt a base64 encoded message with a public key
  // tip: use the provided base64ToArrayBuffer function

  const data = base64ToArrayBuffer(b64Data);
  const privateKey = await importPubKey(strPublicKey);
  // Encrypt the data
  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    data
  );

  // Convert the encrypted data to a Base64 string
  const encryptedBase64 = arrayBufferToBase64(encrypted);
  return encryptedBase64;
}

// Decrypts a message using an RSA private key
export async function rsaDecrypt(
  data: string,
  privateKey: webcrypto.CryptoKey
): Promise<string> {
  // TODO implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function

  const dataBuffer = base64ToArrayBuffer(data);
  
  // Decrypt the data
  const decrypted = await webcrypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    dataBuffer
  );
  
  // Convert the decrypted data to a Base64 string
  const decryptedBase64 = arrayBufferToBase64(decrypted);

  return decryptedBase64;
}

// ######################
// ### Symmetric keys ###
// ######################

// Generates a random symmetric key
export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  // TODO implement this function using the crypto package to generate a symmetric key.
  //      the key should be used for both encryption and decryption. Make sure the
  //      keys are extractable.

  const key = await webcrypto.subtle.generateKey(
    {
      name: "AES-CBC",
      length: 256, // can be  128, 192, or 256
    },
    true, // whether the key is extractable (i.e. can be used in exportKey)
    ["encrypt", "decrypt"] // can be any combination of 'encrypt', 'decrypt', 'wrapKey', 'unwrapKey'
  );
  return key;
}

// Export a crypto symmetric key to a base64 string format
export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  // TODO implement this function to return a base64 string version of a symmetric key

  // remove this
  return arrayBufferToBase64(await webcrypto.subtle.exportKey("raw", key));
}

// Import a base64 string format to its crypto native format
export async function importSymKey(
  strKey: string
): Promise<webcrypto.CryptoKey> {
  // TODO implement this function to go back from the result of the exportSymKey function to it's native crypto key object

  return webcrypto.subtle.importKey("raw", base64ToArrayBuffer(strKey), "AES-CBC", true, ["encrypt", "decrypt"]);;
}

// Encrypt a message using a symmetric key
export async function symEncrypt(
  key: webcrypto.CryptoKey,
  data: string
): Promise<string> {
  // TODO implement this function to encrypt a base64 encoded message with a public key
  // tip: encode the data to a uin8array with TextEncoder

  const dataBuffer = new TextEncoder().encode(data);
  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    key,
    dataBuffer
  );
  return arrayBufferToBase64(encrypted);
}

// Decrypt a message using a symmetric key
export async function symDecrypt(
  strKey: string,
  encryptedData: string
): Promise<string> {
  // TODO implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function and use TextDecode to go back to a string format

  const decrypted = await webcrypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    await importSymKey(strKey),
    base64ToArrayBuffer(encryptedData)
  );
  return new TextDecoder().decode(decrypted);
}
