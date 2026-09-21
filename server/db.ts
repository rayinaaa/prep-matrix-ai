import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { Kit } from '../src/core/types.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

export interface KitRecord {
  id: string;
  userId: string;
  kit: Kit;
  createdAt: string;
  updatedAt: string;
}

// File-backed zero-config database store fallback
class LocalFileStore {
  private dataDir: string;
  private usersFile: string;
  private kitsFile: string;
  private users: Map<string, UserRecord> = new Map();
  private kits: Map<string, KitRecord> = new Map();

  constructor() {
    this.dataDir = path.resolve(process.cwd(), '.data');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.kitsFile = path.join(this.dataDir, 'kits.json');
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (fs.existsSync(this.usersFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.usersFile, 'utf-8'));
        raw.forEach((u: UserRecord) => this.users.set(u.id, u));
      } catch (err) {
        console.warn('Failed to load users.json:', err);
      }
    }
    if (fs.existsSync(this.kitsFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.kitsFile, 'utf-8'));
        raw.forEach((k: KitRecord) => this.kits.set(k.id, k));
      } catch (err) {
        console.warn('Failed to load kits.json:', err);
      }
    }
  }

  private saveUsers() {
    fs.writeFileSync(this.usersFile, JSON.stringify(Array.from(this.users.values()), null, 2));
  }

  private saveKits() {
    fs.writeFileSync(this.kitsFile, JSON.stringify(Array.from(this.kits.values()), null, 2));
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    this.users.set(user.id, user);
    this.saveUsers();
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) || null;
  }

  async createKit(record: KitRecord): Promise<KitRecord> {
    this.kits.set(record.id, record);
    this.saveKits();
    return record;
  }

  async findKitsByUserId(userId: string): Promise<KitRecord[]> {
    return Array.from(this.kits.values())
      .filter((k) => k.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async findKitById(id: string, userId?: string): Promise<KitRecord | null> {
    const record = this.kits.get(id);
    if (!record) return null;
    if (userId && record.userId !== userId) return null;
    return record;
  }

  async updateKit(id: string, userId: string, updatedKit: Kit): Promise<KitRecord | null> {
    const existing = await this.findKitById(id, userId);
    if (!existing) return null;
    existing.kit = updatedKit;
    existing.updatedAt = new Date().toISOString();
    this.kits.set(id, existing);
    this.saveKits();
    return existing;
  }

  async deleteKit(id: string, userId: string): Promise<boolean> {
    const existing = await this.findKitById(id, userId);
    if (!existing) return false;
    this.kits.delete(id);
    this.saveKits();
    return true;
  }
}

export const db = new LocalFileStore();

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (uri && uri.startsWith('mongodb')) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
      console.log('✓ Connected to MongoDB');
      return;
    } catch (err: any) {
      console.warn('MongoDB connection failed. Falling back to persistent local storage:', err.message);
    }
  }
  console.log('✓ Using persistent local storage (.data/)');
}
