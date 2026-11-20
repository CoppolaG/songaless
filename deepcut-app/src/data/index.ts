import { localStore } from './localStore';
import { mockCommunity } from './mockCommunity';
import { createSupabaseCommunity } from './supabaseCommunity';
import type { CommunityService, PlayerStore } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Dati personali del giocatore (sempre nel browser). */
export const player: PlayerStore = localStore;

/** Dati di tutti i giocatori: Supabase se configurato, altrimenti simulati. */
export const community: CommunityService = url && key ? createSupabaseCommunity(url, key) : mockCommunity;

export type { CommunityService, PlayerStore };
