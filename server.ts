import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Bill, Product, ShopSettings, StockMovement, StaffUser, AuditLogEntry, ShiftSession, UserRole } from './src/types';
import { DEFAULT_SETTINGS, INITIAL_PRODUCTS } from './src/lib/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'pos_database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Secure PBKDF2 Password/PIN Hashing with Unique Salt
function hashPin(pin: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pin).trim(), salt, 10000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function verifyPin(pin: string, hash?: string, salt?: string): boolean {
  if (!hash || !salt || !pin) return false;
  try {
    const computed = crypto.pbkdf2Sync(String(pin).trim(), salt, 10000, 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// Strip sensitive security data from user objects before returning to client
function sanitizeUser(user: StaffUser): Omit<StaffUser, 'pin' | 'pinHash' | 'pinSalt'> {
  const { pin, pinHash, pinSalt, ...safe } = user;
  return safe;
}

// Initial Seed Users with Pre-Computed Salted Hashes (Never plaintext)
const initOwnerHash = hashPin('1234');
const initCashier1Hash = hashPin('1122');
const initCashier2Hash = hashPin('3344');

const DEFAULT_USERS: StaffUser[] = [
  {
    id: 'user-owner-01',
    name: 'Shop Owner',
    username: 'owner',
    role: 'owner',
    pinHash: initOwnerHash.hash,
    pinSalt: initOwnerHash.salt,
    phone: '+91 98230 45678',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-cashier-01',
    name: 'Counter Cashier 1',
    username: 'cashier1',
    role: 'cashier',
    pinHash: initCashier1Hash.hash,
    pinSalt: initCashier1Hash.salt,
    phone: '+91 98230 33445',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-cashier-02',
    name: 'Counter Cashier 2',
    username: 'cashier2',
    role: 'cashier',
    pinHash: initCashier2Hash.hash,
    pinSalt: initCashier2Hash.salt,
    phone: '+91 98230 55667',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

interface DatabaseSchema {
  products: Product[];
  bills: Bill[];
  stockMovements: StockMovement[];
  settings: ShopSettings;
  users: StaffUser[];
  auditLogs: AuditLogEntry[];
  shifts: ShiftSession[];
  idempotencyKeys: { [key: string]: { billId: string; timestamp: string } };
}

// In-Memory Database Cache
let db: DatabaseSchema = {
  products: [...INITIAL_PRODUCTS],
  bills: [],
  stockMovements: [],
  settings: { ...DEFAULT_SETTINGS },
  users: [...DEFAULT_USERS],
  auditLogs: [],
  shifts: [],
  idempotencyKeys: {},
};

// Session Management
interface AuthSession {
  token: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  createdAt: number;
}
const activeSessions = new Map<string, AuthSession>();

// Load persistent DB from disk and automatically migrate legacy data safely
function loadDatabase(): void {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      db = {
        products: parsed.products || [...INITIAL_PRODUCTS],
        bills: parsed.bills || [],
        stockMovements: parsed.stockMovements || [],
        settings: parsed.settings || { ...DEFAULT_SETTINGS },
        users: parsed.users && parsed.users.length > 0 ? parsed.users : [...DEFAULT_USERS],
        auditLogs: parsed.auditLogs || [],
        shifts: parsed.shifts || [],
        idempotencyKeys: parsed.idempotencyKeys || {},
      };

      // Security Migration: Convert any plaintext PINs to salted PBKDF2 hashes
      let migrationNeeded = false;
      for (const u of db.users) {
        if ((u as any).pin && !u.pinHash) {
          const { hash, salt } = hashPin((u as any).pin);
          u.pinHash = hash;
          u.pinSalt = salt;
          delete (u as any).pin;
          migrationNeeded = true;
        }
      }

      // Ensure at least one owner account exists
      if (!db.users.some((u) => u.role === 'owner' && u.isActive)) {
        db.users.unshift(DEFAULT_USERS[0]);
        migrationNeeded = true;
      }

      // Ensure ownerName is initialized in settings
      if (!db.settings.ownerName) {
        const ownerUser = db.users.find((u) => u.role === 'owner');
        db.settings.ownerName = ownerUser && !ownerUser.name.includes('Rajesh Agarwal') ? ownerUser.name : 'Shop Owner';
        migrationNeeded = true;
      }

      // Automatically migrate any legacy hardcoded names in users and audit logs
      for (const u of db.users) {
        if (u.name && u.name.includes('Rajesh Agarwal')) {
          u.name = db.settings.ownerName || 'Shop Owner';
          migrationNeeded = true;
        }
      }
      for (const a of db.auditLogs) {
        if (a.userName && a.userName.includes('Rajesh Agarwal')) {
          a.userName = db.settings.ownerName || 'Shop Owner';
          migrationNeeded = true;
        }
      }

      if (migrationNeeded) {
        saveDatabase();
        console.log('[POS Security] Migrated user PINs to salted PBKDF2 hashes.');
      }

      console.log(`[POS Database] Loaded from ${DB_FILE}. Bills: ${db.bills.length}, Products: ${db.products.length}, Users: ${db.users.length}`);
    } else {
      saveDatabase();
      console.log(`[POS Database] Initialized default database at ${DB_FILE}`);
    }
  } catch (err) {
    console.error('[POS Database] Failed to read database file, initializing defaults:', err);
    saveDatabase();
  }
}

// Save persistent DB to disk atomically
function saveDatabase(): void {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[POS Database] Error saving database file:', err);
  }
}

// Audit Log Helper
function recordAudit(
  action: AuditLogEntry['action'],
  userId: string,
  userName: string,
  userRole: UserRole,
  details: string,
  targetId?: string
): void {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    userRole,
    action,
    details,
    targetId,
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 2000) {
    db.auditLogs = db.auditLogs.slice(0, 2000);
  }
}

// Real-Time SSE Clients
const sseClients = new Set<Response>();

function broadcast(eventType: string, payload: any): void {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Initialize DB on boot
loadDatabase();

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // Prevent browser caching on all API routes
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });

  // Extract Session Token Middleware
  app.use('/api', (req: Request, res: Response, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.headers['x-auth-token'] as string);

    if (token && activeSessions.has(token)) {
      (req as any).session = activeSessions.get(token);
    } else {
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        const u = db.users.find((user) => user.id === userId && user.isActive);
        if (u) {
          (req as any).session = {
            token: token || 'session-user',
            userId: u.id,
            userName: u.name,
            userRole: u.role,
            createdAt: Date.now(),
          };
        } else {
          (req as any).session = null;
        }
      } else {
        (req as any).session = null;
      }
    }
    next();
  });

  // Helper: Enforce Owner-Only Access
  const requireOwner = (req: Request, res: Response, next: () => void) => {
    const session = (req as any).session as AuthSession | null;
    if (session && session.userRole === 'owner') {
      return next();
    }
    const ownerPin = req.body?.ownerPin;
    if (ownerPin) {
      const owner = db.users.find(
        (u) => u.role === 'owner' && u.isActive && verifyPin(ownerPin, u.pinHash, u.pinSalt)
      );
      if (owner) {
        (req as any).session = {
          token: 'owner-pin-session',
          userId: owner.id,
          userName: owner.name,
          userRole: 'owner',
          createdAt: Date.now(),
        };
        return next();
      }
    }
    res.status(403).json({
      error: 'Forbidden: Owner permission is required for this action.',
    });
  };

  // -------------------------------------------------------------
  // HEALTH & SYNC STATUS
  // -------------------------------------------------------------
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      shop: db.settings.shopName,
      serverTime: new Date().toISOString(),
      activeTerminals: sseClients.size,
      totalBills: db.bills.length,
      totalProducts: db.products.length,
    });
  });

  // -------------------------------------------------------------
  // REAL-TIME SERVER-SENT EVENTS (SSE)
  // -------------------------------------------------------------
  app.get('/api/sync/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: CONNECTED\ndata: ${JSON.stringify({ message: 'Connected to PRIME CENTURY SWEET Cloud Sync', timestamp: new Date().toISOString() })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // SSE Heartbeat keep-alive every 15 seconds
  setInterval(() => {
    const ping = `event: PING\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(ping);
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15000);

  // -------------------------------------------------------------
  // FULL CLOUD SYNC SNAPSHOT (NEVER EXPOSES PINs OR HASHES)
  // -------------------------------------------------------------
  app.get('/api/sync/full', (req: Request, res: Response) => {
    res.json({
      products: db.products,
      bills: db.bills,
      stockMovements: db.stockMovements,
      settings: db.settings,
      users: db.users.map(sanitizeUser),
      auditLogs: db.auditLogs.slice(0, 200),
      shifts: db.shifts,
      serverTime: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------
  // AUTHENTICATION & USERS (RBAC)
  // -------------------------------------------------------------

  // Login: verifies PIN against salted PBKDF2 hash, issues crypto session token
  app.post('/api/auth/login', (req: Request, res: Response): void => {
    const { pin, userId, username } = req.body;

    if (!pin) {
      res.status(400).json({ error: 'Please enter a PIN to log in.' });
      return;
    }

    let matchedUser: StaffUser | undefined;

    if (userId) {
      const candidate = db.users.find((u) => u.id === userId && u.isActive);
      if (candidate && verifyPin(pin, candidate.pinHash, candidate.pinSalt)) {
        matchedUser = candidate;
      }
    } else if (username) {
      const candidate = db.users.find(
        (u) => u.isActive && u.username.toLowerCase() === String(username).toLowerCase()
      );
      if (candidate && verifyPin(pin, candidate.pinHash, candidate.pinSalt)) {
        matchedUser = candidate;
      }
    } else {
      // Find active user whose PIN matches
      matchedUser = db.users.find(
        (u) => u.isActive && verifyPin(pin, u.pinHash, u.pinSalt)
      );
    }

    if (!matchedUser) {
      res.status(401).json({ error: 'Invalid PIN or unauthorized credentials.' });
      return;
    }

    matchedUser.lastLoginAt = new Date().toISOString();
    saveDatabase();

    // Generate random 256-bit cryptographically secure session token
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      token,
      userId: matchedUser.id,
      userName: matchedUser.name,
      userRole: matchedUser.role,
      createdAt: Date.now(),
    });

    recordAudit('LOGIN', matchedUser.id, matchedUser.name, matchedUser.role, `Logged in to POS terminal`);

    res.json({
      success: true,
      token,
      user: sanitizeUser(matchedUser),
    });
  });

  // Verify Owner PIN for sensitive operations (Owner re-authenticating)
  app.post('/api/auth/verify-owner-pin', (req: Request, res: Response): void => {
    const { ownerPin } = req.body;
    const session = (req as any).session as AuthSession | null;

    if (!session || session.userRole !== 'owner') {
      res.status(403).json({ error: 'Forbidden: Only the owner can verify owner PIN.' });
      return;
    }

    const owner = db.users.find((u) => u.id === session.userId && u.role === 'owner');
    if (!owner || !verifyPin(ownerPin, owner.pinHash, owner.pinSalt)) {
      res.status(401).json({ error: 'Incorrect Owner PIN. Verification failed.' });
      return;
    }

    res.json({ success: true, message: 'Owner PIN verified.' });
  });

  // Get current logged-in user profile
  app.get('/api/auth/me', (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession | null;
    if (!session) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const user = db.users.find((u) => u.id === session.userId);
    if (!user) {
      res.status(404).json({ error: 'User record not found.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  });

  // List staff users (Always sanitized, never exposes PINs)
  app.get('/api/auth/users', (req: Request, res: Response) => {
    res.json(db.users.map(sanitizeUser));
  });

  // Create new staff account (Owner only)
  app.post('/api/auth/users', requireOwner, (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession;
    const { name, username, role, pin, phone } = req.body;

    if (!name || !pin || !role) {
      res.status(400).json({ error: 'Name, Role, and 4-digit PIN are required.' });
      return;
    }

    if (String(pin).trim().length !== 4) {
      res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
      return;
    }

    // Check duplicate PIN against existing users
    const duplicate = db.users.some(
      (u) => u.isActive && verifyPin(pin, u.pinHash, u.pinSalt)
    );
    if (duplicate) {
      res.status(400).json({ error: 'This PIN is already assigned to another staff member. Please choose a different PIN.' });
      return;
    }

    // Salt and hash the new PIN
    const { hash, salt } = hashPin(pin);

    const newUser: StaffUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      username: username ? username.trim().toLowerCase() : `staff_${Math.floor(100 + Math.random() * 900)}`,
      role: role === 'owner' ? 'owner' : (role === 'manager' ? 'manager' : 'cashier'),
      pinHash: hash,
      pinSalt: salt,
      phone: phone ? phone.trim() : undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDatabase();

    recordAudit('USER_CREATE', session.userId, session.userName, session.userRole, `Created staff account for "${newUser.name}" (Role: ${newUser.role})`, newUser.id);

    broadcast('USER_UPDATED', { users: db.users.map(sanitizeUser) });
    res.json({ success: true, user: sanitizeUser(newUser) });
  });

  // Edit user profile: Name, Role, Phone, Deactivate/Reactivate (Owner only)
  app.put('/api/auth/users/:id', requireOwner, (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession;
    const { id } = req.params;
    const { name, role, isActive, phone } = req.body;

    const user = db.users.find((u) => u.id === id);
    if (!user) {
      res.status(404).json({ error: 'Staff user not found.' });
      return;
    }

    // Prevent deactivating the only owner
    if (isActive === false && user.role === 'owner') {
      const activeOwners = db.users.filter((u) => u.role === 'owner' && u.isActive);
      if (activeOwners.length <= 1) {
        res.status(400).json({ error: 'Cannot deactivate the primary Owner account.' });
        return;
      }
    }

    const oldName = user.name;
    const oldStatus = user.isActive;

    if (name && name.trim()) {
      user.name = name.trim();
      if (user.role === 'owner') {
        db.settings.ownerName = user.name;
        broadcast('SETTINGS_UPDATED', { settings: db.settings });
      }
    }
    if (phone !== undefined) user.phone = phone ? phone.trim() : undefined;
    if (role && (role === 'owner' || role === 'manager' || role === 'cashier')) {
      user.role = role;
    }
    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
    }

    saveDatabase();

    if (isActive !== undefined && isActive !== oldStatus) {
      recordAudit(
        isActive ? 'USER_REACTIVATE' : 'USER_DEACTIVATE',
        session.userId,
        session.userName,
        session.userRole,
        `${isActive ? 'Reactivated' : 'Deactivated'} account for "${user.name}"`,
        user.id
      );
    } else {
      recordAudit(
        'USER_UPDATE',
        session.userId,
        session.userName,
        session.userRole,
        `Updated details for "${user.name}" (Previously "${oldName}")`,
        user.id
      );
    }

    broadcast('USER_UPDATED', { users: db.users.map(sanitizeUser) });
    res.json({ success: true, user: sanitizeUser(user) });
  });

  // Reset PIN: Owner only, strictly requires owner authentication and new 4-digit PIN
  app.post('/api/auth/reset-pin', requireOwner, (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession;
    const { targetUserId, ownerPin, newPin } = req.body;

    if (!targetUserId || !ownerPin || !newPin) {
      res.status(400).json({ error: 'Target user ID, Owner PIN verification, and New PIN are required.' });
      return;
    }

    if (String(newPin).trim().length !== 4) {
      res.status(400).json({ error: 'New PIN must be exactly 4 digits.' });
      return;
    }

    // Authenticate the owner's identity with their current Owner PIN
    const owner = db.users.find(
      (u) => u.role === 'owner' && u.isActive && verifyPin(ownerPin, u.pinHash, u.pinSalt)
    );
    if (!owner) {
      res.status(401).json({ error: 'Owner authentication failed: Incorrect Owner PIN entered.' });
      return;
    }

    const targetUser = db.users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'Target user account not found.' });
      return;
    }

    // Compute new salted hash
    const { hash, salt } = hashPin(newPin);
    targetUser.pinHash = hash;
    targetUser.pinSalt = salt;
    delete (targetUser as any).pin;

    saveDatabase();

    recordAudit(
      'PIN_RESET',
      session.userId,
      session.userName,
      session.userRole,
      `Reset PIN for user "${targetUser.name}" (${targetUser.role.toUpperCase()})`,
      targetUser.id
    );

    broadcast('USER_UPDATED', { users: db.users.map(sanitizeUser) });
    res.json({ success: true, message: `PIN updated successfully for ${targetUser.name}.` });
  });

  // -------------------------------------------------------------
  // BILL CREATION WITH ATOMIC CONCURRENCY & DOUBLE-CLICK GUARD
  // -------------------------------------------------------------
  app.post('/api/bills', (req: Request, res: Response): void => {
    const rawBill = req.body as Bill;
    const { idempotencyKey } = rawBill;
    const session = (req as any).session as AuthSession | null;

    // 1. Guard against Double-Click & Network Retries
    if (idempotencyKey && db.idempotencyKeys[idempotencyKey]) {
      const existingBillId = db.idempotencyKeys[idempotencyKey].billId;
      const existingBill = db.bills.find((b) => b.id === existingBillId);
      if (existingBill) {
        res.json({ success: true, bill: existingBill, duplicatePrevented: true });
        return;
      }
    }

    if (!rawBill.items || rawBill.items.length === 0) {
      res.status(400).json({ error: 'Cannot create an empty bill. Please add sweets to the cart.' });
      return;
    }

    // 2. Atomic Stock Concurrency Check: Handle two cashiers selling simultaneously
    const insufficientItems: string[] = [];
    if (!db.settings.allowNegativeStock) {
      for (const cartItem of rawBill.items) {
        const product = db.products.find((p) => p.id === cartItem.productId);
        if (product && product.isActive) {
          if (product.stockQty < cartItem.quantity) {
            insufficientItems.push(
              `"${product.name}": Available ${product.stockQty.toFixed(2)} ${product.unit}, requested ${cartItem.quantity.toFixed(2)} ${product.unit}`
            );
          }
        }
      }
    }

    if (insufficientItems.length > 0) {
      res.status(409).json({
        error: `Insufficient stock on server. Another cashier may have just completed a sale:\n• ${insufficientItems.join('\n• ')}`,
      });
      return;
    }

    // 3. Atomically Generate Invoice Number on Server
    const currentNumber = db.settings.nextInvoiceNumber || 1001;
    const billNumber = `${db.settings.invoicePrefix || 'PCS-2026-'}${String(currentNumber).padStart(4, '0')}`;
    db.settings.nextInvoiceNumber = currentNumber + 1;

    // 4. Server Timestamp
    const serverTimestamp = new Date().toISOString();

    const finalBill: Bill = {
      ...rawBill,
      id: rawBill.id || `bill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      billNumber,
      createdAt: serverTimestamp,
      cashierName: session?.userName || rawBill.cashierName || 'Counter Cashier',
      createdByUserId: session?.userId || rawBill.createdByUserId,
      status: 'completed',
    };

    // 5. Atomic Stock Deduction & Movement Logging
    const createdMovements: StockMovement[] = [];
    for (const item of finalBill.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (product) {
        const prevStock = product.stockQty;
        product.stockQty = Number((product.stockQty - item.quantity).toFixed(3));
        product.updatedAt = serverTimestamp;

        const movement: StockMovement = {
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: product.id,
          productName: product.name,
          type: 'sale',
          quantityDelta: -item.quantity,
          previousStock: prevStock,
          newStock: product.stockQty,
          unit: item.displayUnit || product.unit,
          billNumber: finalBill.billNumber,
          timestamp: serverTimestamp,
        };
        db.stockMovements.unshift(movement);
        createdMovements.push(movement);
      }
    }

    // 6. Record Bill & Idempotency Key
    db.bills.unshift(finalBill);
    if (idempotencyKey) {
      db.idempotencyKeys[idempotencyKey] = {
        billId: finalBill.id,
        timestamp: serverTimestamp,
      };
    }

    // 7. Audit Trail
    recordAudit(
      'BILL_CREATE',
      finalBill.createdByUserId || session?.userId || 'cashier',
      finalBill.cashierName || 'Cashier',
      session?.userRole || 'cashier',
      `Created Bill #${finalBill.billNumber} for ₹${finalBill.grandTotal.toFixed(2)} (${finalBill.paymentMethod.toUpperCase()})`,
      finalBill.id
    );

    saveDatabase();

    // 8. Broadcast in Real-Time to All Connected Terminals via SSE
    broadcast('BILL_CREATED', {
      bill: finalBill,
      products: db.products,
      stockMovements: createdMovements,
      nextInvoiceNumber: db.settings.nextInvoiceNumber,
    });

    res.json({
      success: true,
      bill: finalBill,
      products: db.products,
    });
  });

  // -------------------------------------------------------------
  // BILL EDITING: STRICT OWNER-ONLY PERMISSION
  // -------------------------------------------------------------
  app.put('/api/bills/:id', requireOwner, (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession;
    const { id } = req.params;
    const { updatedBill, reason } = req.body;

    const billIndex = db.bills.findIndex((b) => b.id === id);
    if (billIndex === -1) {
      res.status(404).json({ error: 'Bill not found.' });
      return;
    }

    const oldBill = db.bills[billIndex];
    const serverTimestamp = new Date().toISOString();

    // Revert old items stock
    for (const oldItem of oldBill.items) {
      const prod = db.products.find((p) => p.id === oldItem.productId);
      if (prod) {
        prod.stockQty = Number((prod.stockQty + oldItem.quantity).toFixed(3));
      }
    }

    // Apply new items stock
    for (const newItem of (updatedBill.items || [])) {
      const prod = db.products.find((p) => p.id === newItem.productId);
      if (prod) {
        prod.stockQty = Number((prod.stockQty - newItem.quantity).toFixed(3));
      }
    }

    const auditHistory = oldBill.editHistory || [];
    auditHistory.push({
      editedAt: serverTimestamp,
      editedBy: session.userName,
      reason: reason || 'Owner edited bill',
      previousGrandTotal: oldBill.grandTotal,
      previousItemsSummary: oldBill.items.map((it: any) => `${it.name} (${it.displayQuantity}${it.displayUnit})`).join(', '),
    });

    const mergedBill: Bill = {
      ...updatedBill,
      id: oldBill.id,
      billNumber: oldBill.billNumber,
      createdAt: oldBill.createdAt,
      status: 'edited',
      editHistory: auditHistory,
    };

    db.bills[billIndex] = mergedBill;

    recordAudit(
      'BILL_EDIT',
      session.userId,
      session.userName,
      session.userRole,
      `Owner edited Bill #${mergedBill.billNumber}. Previous Total: ₹${oldBill.grandTotal}, New Total: ₹${mergedBill.grandTotal}. Reason: ${reason || 'N/A'}`,
      mergedBill.id
    );

    saveDatabase();

    broadcast('BILL_UPDATED', {
      bill: mergedBill,
      products: db.products,
    });

    res.json({ success: true, bill: mergedBill, products: db.products });
  });

  // -------------------------------------------------------------
  // BILL DELETION: STRICT OWNER-ONLY PERMISSION WITH CONFIRMATION
  // -------------------------------------------------------------
  app.delete('/api/bills/:id', requireOwner, (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession;
    const { id } = req.params;
    const { reason, restock } = req.body;

    const billIndex = db.bills.findIndex((b) => b.id === id);
    if (billIndex === -1) {
      res.status(404).json({ error: 'Bill not found.' });
      return;
    }

    const bill = db.bills[billIndex];
    const serverTimestamp = new Date().toISOString();

    // Restock items back to inventory if requested (default true)
    const restockMovements: StockMovement[] = [];
    if (restock !== false) {
      for (const item of bill.items) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod) {
          const prev = prod.stockQty;
          prod.stockQty = Number((prod.stockQty + item.quantity).toFixed(3));
          const movement: StockMovement = {
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: prod.id,
            productName: prod.name,
            type: 'cancellation_return',
            quantityDelta: item.quantity,
            previousStock: prev,
            newStock: prod.stockQty,
            unit: item.displayUnit || prod.unit,
            billNumber: bill.billNumber,
            reason: `Restocked upon bill deletion: ${reason || 'Deleted by Owner'}`,
            timestamp: serverTimestamp,
          };
          db.stockMovements.unshift(movement);
          restockMovements.push(movement);
        }
      }
    }

    // Remove bill from database
    db.bills.splice(billIndex, 1);

    recordAudit(
      'BILL_DELETE',
      session.userId,
      session.userName,
      session.userRole,
      `Owner deleted Bill #${bill.billNumber} (Amount: ₹${bill.grandTotal.toFixed(2)}, Items: ${bill.items.length}). Reason: ${reason || 'Removed by Owner'}`,
      bill.id
    );

    saveDatabase();

    broadcast('BILL_DELETED', {
      billId: bill.id,
      products: db.products,
      stockMovements: restockMovements,
    });

    res.json({ success: true, message: `Bill #${bill.billNumber} deleted successfully.`, products: db.products });
  });

  // -------------------------------------------------------------
  // BILL CANCELLATION / REFUND: STRICT OWNER-ONLY PERMISSION
  // -------------------------------------------------------------
  app.post('/api/bills/:id/cancel', requireOwner, (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession;
    const { id } = req.params;
    const { action, reason } = req.body;

    const bill = db.bills.find((b) => b.id === id);
    if (!bill) {
      res.status(404).json({ error: 'Bill not found.' });
      return;
    }

    if (bill.status === 'cancelled') {
      res.status(400).json({ error: 'Bill is already cancelled.' });
      return;
    }

    const serverTimestamp = new Date().toISOString();
    bill.status = action === 'refunded' ? 'refunded' : 'cancelled';
    bill.cancellationDetails = {
      cancelledAt: serverTimestamp,
      cancelledBy: session.userName,
      reason: reason || 'Customer returned sweets',
    };

    // Restock all items back to inventory
    const restockMovements: StockMovement[] = [];
    for (const item of bill.items) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (prod) {
        const prev = prod.stockQty;
        prod.stockQty = Number((prod.stockQty + item.quantity).toFixed(3));
        const movement: StockMovement = {
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          productName: prod.name,
          type: 'cancellation_return',
          quantityDelta: item.quantity,
          previousStock: prev,
          newStock: prod.stockQty,
          unit: item.displayUnit || prod.unit,
          billNumber: bill.billNumber,
          reason: `Restocked on bill ${action}: ${reason}`,
          timestamp: serverTimestamp,
        };
        db.stockMovements.unshift(movement);
        restockMovements.push(movement);
      }
    }

    recordAudit(
      'BILL_CANCEL',
      session.userId,
      session.userName,
      session.userRole,
      `${action === 'refunded' ? 'Refunded' : 'Cancelled'} Bill #${bill.billNumber} for ₹${bill.grandTotal}. Reason: ${reason || 'N/A'}`,
      bill.id
    );

    saveDatabase();

    broadcast('BILL_CANCELLED', {
      billId: bill.id,
      bill,
      products: db.products,
      stockMovements: restockMovements,
    });

    res.json({ success: true, bill, products: db.products });
  });

  // -------------------------------------------------------------
  // PRODUCTS CRUD
  // -------------------------------------------------------------
  app.get('/api/products', (req: Request, res: Response) => {
    res.json(db.products);
  });

  app.post('/api/products', (req: Request, res: Response): void => {
    const rawProd = req.body as Product;
    if (!rawProd.name || !rawProd.sellingPrice) {
      res.status(400).json({ error: 'Sweet name and selling price are required.' });
      return;
    }

    const serverTimestamp = new Date().toISOString();
    const newProduct: Product = {
      ...rawProd,
      id: rawProd.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stockQty: Number(rawProd.stockQty) || 0,
      sellingPrice: Number(rawProd.sellingPrice),
      costPrice: Number(rawProd.costPrice) || 0,
      gstRate: Number(rawProd.gstRate) || 5,
      isActive: rawProd.isActive !== false,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    };

    const existingIndex = db.products.findIndex((p) => p.id === newProduct.id);
    if (existingIndex >= 0) {
      db.products[existingIndex] = newProduct;
    } else {
      db.products.push(newProduct);
    }

    saveDatabase();
    broadcast('PRODUCT_UPDATED', { product: newProduct, products: db.products });
    res.json({ success: true, product: newProduct });
  });

  app.put('/api/products/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    const updateData = req.body as Partial<Product>;
    const session = (req as any).session as AuthSession | null;

    const prod = db.products.find((p) => p.id === id);
    if (!prod) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const oldPrice = prod.sellingPrice;
    Object.assign(prod, updateData);
    prod.updatedAt = new Date().toISOString();

    if (updateData.sellingPrice && updateData.sellingPrice !== oldPrice) {
      recordAudit(
        'PRICE_CHANGE',
        session?.userId || 'system',
        session?.userName || 'Staff',
        session?.userRole || 'manager',
        `Changed price of "${prod.name}" from ₹${oldPrice} to ₹${prod.sellingPrice}`,
        prod.id
      );
    }

    saveDatabase();
    broadcast('PRODUCT_UPDATED', { product: prod, products: db.products });
    res.json({ success: true, product: prod });
  });

  app.delete('/api/products/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    const prod = db.products.find((p) => p.id === id);
    if (!prod) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    prod.isActive = false;
    prod.updatedAt = new Date().toISOString();

    saveDatabase();
    broadcast('PRODUCT_UPDATED', { product: prod, products: db.products });
    res.json({ success: true, message: 'Product archived.' });
  });

  // -------------------------------------------------------------
  // INVENTORY ADJUSTMENT / RESTOCK
  // -------------------------------------------------------------
  app.post('/api/inventory/adjust', (req: Request, res: Response): void => {
    const { productId, type, quantityDelta, reason } = req.body;
    const session = (req as any).session as AuthSession | null;

    const prod = db.products.find((p) => p.id === productId);
    if (!prod) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const serverTimestamp = new Date().toISOString();
    const prev = prod.stockQty;
    prod.stockQty = Number((prod.stockQty + Number(quantityDelta)).toFixed(3));
    prod.updatedAt = serverTimestamp;

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: prod.id,
      productName: prod.name,
      type: type || 'adjustment',
      quantityDelta: Number(quantityDelta),
      previousStock: prev,
      newStock: prod.stockQty,
      unit: prod.unit,
      reason: reason || 'Manual stock modification',
      timestamp: serverTimestamp,
    };

    db.stockMovements.unshift(movement);

    recordAudit(
      'STOCK_ADJUST',
      session?.userId || 'system',
      session?.userName || 'Staff',
      session?.userRole || 'manager',
      `Adjusted stock for "${prod.name}": Delta ${quantityDelta > 0 ? '+' : ''}${quantityDelta} ${prod.unit} (Reason: ${reason || 'N/A'})`,
      prod.id
    );

    saveDatabase();

    broadcast('STOCK_ADJUSTED', {
      product: prod,
      movement,
      products: db.products,
      stockMovements: db.stockMovements,
    });

    res.json({ success: true, product: prod, movement });
  });

  // -------------------------------------------------------------
  // SETTINGS & GST CONFIGURATION (Owner only)
  // -------------------------------------------------------------
  app.get('/api/settings', (req: Request, res: Response) => {
    res.json(db.settings);
  });

  app.put('/api/settings', requireOwner, (req: Request, res: Response): void => {
    const session = (req as any).session as AuthSession;
    const newSettings = req.body as ShopSettings;

    if ('ownerName' in newSettings) {
      if (!newSettings.ownerName || !newSettings.ownerName.trim()) {
        res.status(400).json({ error: 'Owner Name is required and cannot be empty.' });
        return;
      }
      newSettings.ownerName = newSettings.ownerName.trim();
    }

    db.settings = { ...db.settings, ...newSettings };

    // Synchronize owner account display name in user accounts
    if (newSettings.ownerName) {
      const ownerUser = db.users.find((u) => u.role === 'owner' && u.isActive) || db.users.find((u) => u.role === 'owner');
      if (ownerUser && ownerUser.name !== newSettings.ownerName) {
        ownerUser.name = newSettings.ownerName;
        broadcast('USER_UPDATED', { users: db.users.map(sanitizeUser) });
      }
    }

    recordAudit(
      'SETTINGS_CHANGE',
      session.userId,
      session.userName,
      session.userRole,
      `Updated Shop Settings & Owner Name (${db.settings.ownerName || db.settings.shopName})`
    );

    saveDatabase();
    broadcast('SETTINGS_UPDATED', { settings: db.settings });
    res.json({ success: true, settings: db.settings });
  });

  // -------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    res.json(db.auditLogs);
  });

  // -------------------------------------------------------------
  // BACKUP & RESET (Owner only)
  // -------------------------------------------------------------
  app.get('/api/backup/export', requireOwner, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="PrimeCenturySweet_FullCloudBackup_${new Date().toISOString().split('T')[0]}.json"`);
    // Sanitize users in backup
    const exportDb = {
      ...db,
      users: db.users.map(sanitizeUser),
    };
    res.json(exportDb);
  });

  app.post('/api/backup/import', requireOwner, (req: Request, res: Response): void => {
    try {
      const imported = req.body;
      if (imported.products && imported.bills && imported.settings) {
        db = {
          products: imported.products,
          bills: imported.bills,
          stockMovements: imported.stockMovements || [],
          settings: imported.settings,
          users: imported.users || [...DEFAULT_USERS],
          auditLogs: imported.auditLogs || [],
          shifts: imported.shifts || [],
          idempotencyKeys: {},
        };
        saveDatabase();
        broadcast('FULL_RELOAD', {
          ...db,
          users: db.users.map(sanitizeUser),
        });
        res.json({ success: true, message: 'Cloud database restored successfully.' });
      } else {
        res.status(400).json({ error: 'Invalid backup file structure.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Import failed: ' + err.message });
    }
  });

  app.post('/api/backup/reset', requireOwner, (req: Request, res: Response): void => {
    db = {
      products: [...INITIAL_PRODUCTS],
      bills: [],
      stockMovements: [],
      settings: { ...DEFAULT_SETTINGS },
      users: [...DEFAULT_USERS],
      auditLogs: [],
      shifts: [],
      idempotencyKeys: {},
    };
    saveDatabase();
    broadcast('FULL_RELOAD', {
      ...db,
      users: db.users.map(sanitizeUser),
    });
    res.json({ success: true, message: 'Database reset to default sweets catalog.' });
  });

  // -------------------------------------------------------------
  // VITE DEV MIDDLEWARE / STATIC ASSETS
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: Number(PORT) },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[PRIME CENTURY SWEET POS] Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
