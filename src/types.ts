export enum Rarity {
  COMMON = 'common',
  RARE = 'rare',
  LEGENDARY = 'legendary',
}

export interface Attributes {
  agility: number;
  defense: number;
  attack: number;
}

export interface Collaborator {
  id: string;
  name: string;
  role: string;
  team: string;
  rarity: Rarity;
  attributes: Attributes;
  achievements: string[];
  imageUrl: string;
  bio: string;
}

export interface UserStats {
  stickersOwned: string[];
  duplicates: Record<string, number>;
  packetsOpened: number;
  guessesRight: number;
  guessesTotal: number;
  lastGuessDate: string | null;
  lastPackDate: string | null;
}
