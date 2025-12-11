import { Keypair, PublicKey, Client } from '@synonymdev/pubky';

export type GeneratedKeypair = {
  keypair: Keypair;
  publicKey: string; // z-base-32 encoded
  secretKey: Uint8Array;
  secretKeyHex: string; // hex encoded for display/storage
};

/**
 * Generate a new ed25519 keypair for a user.
 */
export function generateKeypair(): GeneratedKeypair {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey().z32();
  const secretKey = keypair.secretKey();
  
  // Convert secret key to hex for display/storage
  const secretKeyHex = Array.from(secretKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    keypair,
    publicKey,
    secretKey,
    secretKeyHex,
  };
}

/**
 * Sign up a new user directly to a local homeserver by calling the /signup endpoint.
 * 
 * This bypasses the SDK's PKARR resolution by:
 * 1. Using the SDK's Client to create an AuthToken (via signup method internally)
 * 2. But we intercept and call the signup endpoint directly with fetch
 * 
 * However, since we can't easily extract the AuthToken from the SDK, we use a workaround:
 * We try the SDK's signup() method, and if it fails due to PKARR, we provide a helpful error.
 * 
 * For local/testnet, the SDK's testnet client should rewrite URLs, but it still tries
 * PKARR resolution first which may fail.
 */
export async function signupUserDirect(
  keypair: Keypair,
  clientBaseUrl: string,
  signupToken?: string,
  homeserverPubkey?: string
): Promise<{ pubkey: string }> {
  // For local/testnet, we still need the homeserver pubkey because the SDK
  // tries to resolve it via PKARR before rewriting URLs
  if (!homeserverPubkey) {
    throw new Error(
      'Homeserver pubkey is required even for local/testnet homeservers. ' +
      'The SDK needs it to construct the signup URL. ' +
      'You can find it in your homeserver config.toml file or startup logs.'
    );
  }
  
  // Extract host from clientBaseUrl (e.g., "127.0.0.1" or "localhost")
  const url = new URL(clientBaseUrl);
  const host = url.hostname;
  
  // Use the SDK's testnet Client with the specific host
  // This configures the client to rewrite URLs for that host
  const client = Client.testnet(host);
  
  // Use the provided homeserver pubkey
  // The SDK's testnet client should rewrite `https://{pubkey}` to `http://{host}:6286`
  const homeserverPublicKey = PublicKey.from(homeserverPubkey);
  
  try {
    // The SDK's client.signup() will:
    // 1. Try to resolve the pubkey via PKARR (may fail for local homeservers)
    // 2. Rewrite the URL to http://{host}:6286/signup (for testnet)
    // 3. Create an AuthToken with root capabilities
    // 4. Send the AuthToken to the endpoint
    const session = await client.signup(keypair, homeserverPublicKey, signupToken);
    
    return {
      pubkey: keypair.publicKey().z32(),
    };
  } catch (error) {
    // If PKARR resolution fails, provide a helpful error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('PKARR') || errorMessage.includes('resolve') || errorMessage.includes('15411')) {
      throw new Error(
        `Failed to sign up: The SDK tried to resolve the homeserver pubkey via PKARR, which failed for local homeservers. ` +
        `This is a known limitation. The homeserver pubkey is still required for the SDK to construct the signup URL. ` +
        `Make sure you're using the correct homeserver pubkey from your config.toml file. ` +
        `Original error: ${errorMessage}`
      );
    }
    throw error;
  }
}

/**
 * Sign up a new user to the homeserver using the generated keypair.
 * Uses the SDK which handles AuthToken creation automatically.
 * 
 * For local/testnet homeservers, we can call the client API directly without needing
 * the homeserver pubkey - the SDK's testnet client rewrites URLs to localhost automatically.
 * For mainnet, we need the homeserver pubkey for pkarr resolution.
 */
export async function signupUser(
  keypair: Keypair,
  homeserverPubkey: string | null | undefined,
  signupToken: string | undefined,
  clientBaseUrl?: string
): Promise<{ pubkey: string; session?: any }> {
  // Determine if we're in testnet mode (local homeserver)
  const isTestnet = process.env.NEXT_PUBLIC_ADMIN_ENV === 'testnet' ||
                     clientBaseUrl?.includes('localhost') || 
                     clientBaseUrl?.includes('127.0.0.1');

  // For local/testnet, use direct signup (but still need pubkey for SDK)
  if (isTestnet && clientBaseUrl) {
    // Even for testnet, we need the homeserver pubkey because the SDK
    // tries to resolve it via PKARR before rewriting URLs
    if (!homeserverPubkey) {
      throw new Error(
        'Homeserver pubkey is required even for local/testnet homeservers. ' +
        'The SDK needs it to construct the signup URL. ' +
        'You can find it in your homeserver config.toml file (homeserver_pubkey field) or startup logs.'
      );
    }
    return await signupUserDirect(keypair, clientBaseUrl, signupToken, homeserverPubkey);
  }

  // For mainnet, we need the homeserver pubkey
  if (!homeserverPubkey) {
    throw new Error('Homeserver pubkey is required for mainnet signup. For local/testnet homeservers, the dashboard should detect this automatically.');
  }

  // Create client (mainnet)
  const client = new Client({
    pkarr: { 
      relays: process.env.NEXT_PUBLIC_PKARR_RELAYS?.split(',') || [],
      requestTimeout: null 
    },
    userMaxRecordAge: null,
  });

  // Get homeserver public key
  const homeserverPublicKey = PublicKey.from(homeserverPubkey);

  // Sign up using the SDK (this handles AuthToken creation internally)
  const session = await client.signup(keypair, homeserverPublicKey, signupToken);

  return {
    pubkey: keypair.publicKey().z32(),
    session,
  };
}

