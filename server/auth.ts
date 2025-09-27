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
import rateLimit from "express-rate-limit";

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

// تحديد متغيرات البيئة
const ENV_CONFIG = {
  isDevelopment: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined,
  isProduction: process.env.NODE_ENV === 'production',
  isReplit: !!process.env.REPL_ID,
  host: process.env.HOST || 'localhost', // افترض localhost إذا لم يتم تحديده
};

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // أسبوع واحد

  // 🚨 SECURITY: إجبار SESSION_SECRET قوي في الإنتاج
  if (ENV_CONFIG.isProduction && !process.env.SESSION_SECRET) {
    throw new Error('🚨 SECURITY CRITICAL: SESSION_SECRET environment variable is required in production');
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'default-secret-change-in-production') {
    console.error('🚨 SECURITY WARNING: Using weak or default SESSION_SECRET');
  }

  let sessionStore;

  // 🚨 SECURITY: منع MemoryStore في الإنتاج
  if (ENV_CONFIG.isProduction && !process.env.DATABASE_URL) {
    throw new Error('🚨 SECURITY CRITICAL: Database connection required for session persistence in production');
  }

  // Try to use PostgreSQL store with fallback to MemoryStore (development only)
  try {
    if (process.env.DATABASE_URL) {
      const pgStore = connectPg(session);
      sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true, // ✅ SECURITY FIX: تمكين إنشاء الجدول إذا لم يكن موجوداً
        ttl: sessionTtl,
        tableName: "sessions",
      });
      console.log('✅ Using secure PostgreSQL session store');
    } else {
      throw new Error('No DATABASE_URL provided');
    }
  } catch (error) {
    if (ENV_CONFIG.isProduction) {
      throw new Error(`🚨 CRITICAL: Failed to initialize session store in production: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.warn('⚠️ DEVELOPMENT: Falling back to MemoryStore:', error instanceof Error ? error.message : 'Unknown error');
    const MemoryStoreSession = MemoryStore(session);
    sessionStore = new MemoryStoreSession({
      checkPeriod: sessionTtl,
    });
    console.log('⚠️ Using MemoryStore for sessions (DEVELOPMENT ONLY)');
  }

  // 🛡️ SECURITY: إعدادات كوكيز محسنة أمنياً
  const cookieSettings = {
    httpOnly: true, // منع الوصول من JavaScript
    secure: ENV_CONFIG.isProduction, // HTTPS only في الإنتاج
    maxAge: sessionTtl,
    sameSite: ENV_CONFIG.isProduction ? "strict" as const : "lax" as const, // ✅ SECURITY FIX: strict بدلاً من none
    domain: ENV_CONFIG.isReplit ? undefined : ENV_CONFIG.host,
  };

  return session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-immediately',
    store: sessionStore,
    resave: false, // ✅ SECURITY FIX: منع إعادة الحفظ غير الضرورية
    saveUninitialized: false, // ✅ SECURITY FIX: منع حفظ الجلسات الفارغة (مقاومة CSRF)
    name: 'connect.sid',
    cookie: cookieSettings,
    rolling: false, // ✅ SECURITY FIX: منع التجديد المستمر
  });
}

// 🛡️ SECURITY: Helper function to remove password from user object
function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
}

// 🛡️ SECURITY: Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات كحد أقصى لكل IP
  message: {
    error: 'تم تجاوز عدد محاولات تسجيل الدخول المسموحة. يرجى المحاولة بعد 15 دقيقة.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // لا تحسب المحاولات الناجحة
  // 🛡️ SECURITY FIX: Remove custom keyGenerator to use default IPv6-safe one
  // Default generator handles IPv6 properly
});

export function setupAuth(app: Express) {
  // يجب أن يكون express-session قبل passport.session
  app.use(getSession());

  // يجب أن يكون passport.initialize و passport.session بعد express-session
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
        // 🛡️ SECURITY FIX: إزالة كلمة المرور من الاستجابة
        res.status(201).json(sanitizeUser(user));
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صحيحة", details: error.errors });
      }
      next(error);
    }
  });

  // تسجيل الدخول
  app.post("/api/login", loginLimiter, (req, res, next) => {
    // 🛡️ SECURITY FIX: تقليل logging للبيانات الحساسة في الإنتاج
    if (!ENV_CONFIG.isProduction) {
      console.log('Login attempt for user:', req.body.username?.substring(0, 3) + '***');
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: "خطأ في الخادم" });
      }

      if (!user) {
        // 🛡️ SECURITY FIX: تقليل logging لأسماء المستخدمين الفاشلة
        if (!ENV_CONFIG.isProduction) {
          console.log('Login failed for user:', req.body.username?.substring(0, 3) + '***');
        }
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      // 🛡️ SECURITY FIX: تجديد معرف الجلسة لمنع session fixation
      req.session.regenerate((regenerateErr: any) => {
        if (regenerateErr) {
          console.error('Session regeneration error:', regenerateErr);
          return res.status(500).json({ error: "فشل في تجديد الجلسة" });
        }

        req.logIn(user, { session: true }, (err: any) => {
          if (err) {
            console.error('Session creation error:', err);
            return res.status(500).json({ error: "فشل في إنشاء الجلسة" });
          }

          // التأكد من حفظ الجلسة قبل الاستجابة
          req.session.save((saveErr: any) => {
            if (saveErr) {
              console.error('Session save error:', saveErr);
              return res.status(500).json({ error: "فشل في حفظ الجلسة" });
            }

            // 🛡️ SECURITY FIX: إزالة session ID من logs
            if (!ENV_CONFIG.isProduction) {
              console.log('Login successful for user:', user.username?.substring(0, 3) + '***');
            }

            // إضافة headers إضافية للتوافق
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            // 🛡️ SECURITY FIX: استخدام sanitizeUser مع إضافة token للاستجابة
            const userWithToken = {
              ...sanitizeUser(user),
              token: req.sessionID // استخدام session ID كـ token
            };
            res.status(200).json(userWithToken);
          });
        });
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