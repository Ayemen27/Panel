import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage.js";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // أسبوع واحد
  
  let sessionStore;
  
  // Try to use PostgreSQL store with fallback to MemoryStore
  try {
    if (process.env.DATABASE_URL) {
      const pgStore = connectPg(session);
      sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
        ttl: sessionTtl,
        tableName: "sessions",
      });
      console.log('Using PostgreSQL session store');
    } else {
      throw new Error('No DATABASE_URL provided');
    }
  } catch (error) {
    console.warn('Failed to initialize PostgreSQL session store, falling back to MemoryStore:', error instanceof Error ? error.message : 'Unknown error');
    // Fallback to MemoryStore
    sessionStore = MemoryStore(session);
    sessionStore = new sessionStore({
      checkPeriod: sessionTtl, // prune expired entries every 24h
    });
    console.log('Using MemoryStore for sessions');
  }
  
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
  
  return session({
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: {
      httpOnly: true,
      secure: !isDevelopment,
      maxAge: sessionTtl,
      sameSite: isDevelopment ? "lax" : "none",
      domain: undefined, // دع المتصفح يحدد
    },
  });
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          // تحديث آخر تسجيل دخول
          await storage.updateUser(user.id, { lastLogin: new Date() });
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // تسجيل مستخدم جديد
  app.post("/api/register", async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(validatedData.username!);
      if (existingUser) {
        return res.status(400).json({ error: "اسم المستخدم موجود بالفعل" });
      }

      const existingEmail = await storage.getUserByEmail(validatedData.email!);
      if (existingEmail) {
        return res.status(400).json({ error: "البريد الإلكتروني موجود بالفعل" });
      }

      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صحيحة", details: error.errors });
      }
      next(error);
    }
  });

  // تسجيل الدخول
  app.post("/api/login", (req, res, next) => {
    console.log('Login attempt for user:', req.body.username);
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: "خطأ في الخادم" });
      }
      
      if (!user) {
        console.log('Login failed for user:', req.body.username, 'Info:', info);
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      req.logIn(user, (err: any) => {
        if (err) {
          console.error('Session creation error:', err);
          return res.status(500).json({ error: "فشل في إنشاء الجلسة" });
        }
        
        console.log('Login successful for user:', user.username, 'Session ID:', req.sessionID);
        
        // إرجاع بيانات المستخدم بدون كلمة المرور
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // تسجيل الخروج
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // الحصول على المستخدم الحالي
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

// وسطاء للتحقق من المصادقة
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.sendStatus(401);
}

export function requireRole(role: 'admin' | 'moderator' | 'user' | 'viewer') {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    
    const roleHierarchy = {
      admin: 4,
      moderator: 3,
      user: 2,
      viewer: 1,
    };
    
    const userRole = req.user?.role || 'viewer';
    if (roleHierarchy[userRole as keyof typeof roleHierarchy] >= roleHierarchy[role]) {
      return next();
    }
    
    res.sendStatus(403);
  };
}