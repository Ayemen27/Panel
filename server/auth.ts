import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage.js";
import { User as SelectUser, insertUserSchema, UpsertUser } from "@shared/schema";
import { ENV_CONFIG } from "@shared/environment";
import { z } from "zod";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";
import rateLimit from "express-rate-limit";
import jwt from 'jsonwebtoken';

// Session type extensions for auth properties
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
    isAuthenticated?: boolean;
  }
}

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

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}


export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // أسبوع واحد

  // 🚨 SECURITY: إجبار SESSION_SECRET قوي في الإنتاج
  if (ENV_CONFIG.name === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('🚨 SECURITY CRITICAL: SESSION_SECRET environment variable is required in production');
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'default-secret-change-in-production') {
    console.error('🚨 SECURITY WARNING: Using weak or default SESSION_SECRET');
  }

  let sessionStore;

  // 🚨 SECURITY: منع MemoryStore في الإنتاج
  if (ENV_CONFIG.name === 'production' && !process.env.DATABASE_URL) {
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
    if (ENV_CONFIG.name === 'production') {
      throw new Error(`🚨 CRITICAL: Failed to initialize session store in production: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.warn('⚠️ DEVELOPMENT: Falling back to MemoryStore:', error instanceof Error ? error.message : 'Unknown error');
    const MemoryStoreSession = MemoryStore(session);
    sessionStore = new MemoryStoreSession({
      checkPeriod: sessionTtl,
    });
    console.log('⚠️ Using MemoryStore for sessions (DEVELOPMENT ONLY)');
  }

  // 🛡️ KIWI BROWSER FIX: إعدادات كوكيز محسنة للمتصفحات المتنوعة
  // تحديد بروتوكول الاتصال
  const isSecureConnection = process.env.NODE_ENV === 'production' || 
                            process.env.CUSTOM_DOMAIN === 'true' ||
                            process.env.DOMAIN?.includes('binarjoinanelytic.info');

  // تحديد النطاق بذكاء
  let cookieDomain: string | undefined;
  if (process.env.DOMAIN?.includes('binarjoinanelytic.info')) {
    // للنطاق المخصص
    cookieDomain = '.binarjoinanelytic.info'; // نقطة في البداية للسماح للنطاقات الفرعية
  } else {
    // للنطاقات الأخرى مثل Replit
    cookieDomain = undefined; // السماح للمتصفح بتحديد النطاق
  }

  // 🔧 KIWI COMPATIBILITY: إعدادات خاصة للمتصفحات المختلفة
  const cookieSettings = {
    httpOnly: true,
    secure: isSecureConnection, // HTTPS فقط في الإنتاج أو النطاق المخصص
    maxAge: sessionTtl,
    sameSite: isSecureConnection ? "none" as const : "lax" as const, // None للنطاق المخصص، Lax للتطوير
    domain: cookieDomain,
    path: '/', // ضروري للوصول من جميع المسارات
  };

  // سجل تشخيصي مُحسَّن
  console.log('🍪 Enhanced Cookie Settings for Cross-Browser Compatibility:', {
    isSecureConnection,
    cookieDomain,
    secure: cookieSettings.secure,
    sameSite: cookieSettings.sameSite,
    environment: ENV_CONFIG.name,
    customDomain: process.env.DOMAIN,
    userAgent: 'will-be-detected-per-request'
  });

  return session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: 'sid', // اسم أقصر للكوكيز
    cookie: cookieSettings,
    rolling: true, // 🔧 تمكين التجديد التلقائي للجلسات النشطة
    proxy: true, // 🔧 دعم البروكسي والـ reverse proxy
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

const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || SESSION_SECRET;

// دوال إنشاء والتحقق من التوكن
export function generateToken(user: any): string {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

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
        if (!user || !user.password || !(await comparePasswords(password, user.password))) {
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
      // سجل تشخيصي لـ passport deserializeUser
      console.log('👤 Passport Deserialize User:', {
        userID: id ? 'provided' : 'missing',
        timestamp: new Date().toISOString()
      });

      const user = await storage.getUser(id);

      console.log('👤 User Retrieved:', {
        userFound: !!user,
        userID: user?.id ? 'exists' : 'missing',
        username: user?.username ? user.username.substring(0, 3) + '***' : 'missing'
      });

      done(null, user);
    } catch (error) {
      console.error('❌ Passport Deserialize Error:', error);
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
        password: validatedData.password ? await hashPassword(validatedData.password) : undefined,
      } as UpsertUser);

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

  // تسجيل الدخول مع دعم محسن للكوكيز والتوكن
  app.post("/api/login", loginLimiter, (req, res, next) => {
    // 🛡️ SECURITY FIX: تقليل logging للبيانات الحساسة في الإنتاج
    if (ENV_CONFIG.name !== 'production') {
      console.log('Login attempt for user:', req.body.username?.substring(0, 3) + '***');
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: "خطأ في الخادم" });
      }

      if (!user) {
        if (ENV_CONFIG.name !== 'production') {
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

          // 🔧 KIWI FIX: حفظ معرف المستخدم في الجلسة صراحة
          req.session.userId = user.id;
          req.session.userRole = user.role;
          req.session.isAuthenticated = true;

          // التأكد من حفظ الجلسة قبل الاستجابة
          req.session.save((saveErr: any) => {
            if (saveErr) {
              console.error('Session save error:', saveErr);
              return res.status(500).json({ error: "فشل في حفظ الجلسة" });
            }

            if (ENV_CONFIG.name !== 'production') {
              console.log('Login successful for user:', user.username?.substring(0, 3) + '***');
            }

            // إنشاء توكن JWT للمتصفحات التي لا تدعم الكوكيز
            const token = generateToken(user);

            // 🔧 KIWI COMPATIBILITY: إعداد كوكيز إضافية للتوافق
            const userAgent = req.headers['user-agent'] || '';
            const isKiwiBrowser = userAgent.toLowerCase().includes('kiwi') || 
                                userAgent.toLowerCase().includes('mobile') ||
                                userAgent.toLowerCase().includes('android');

            // إضافة كوكيز توكن احتياطية للمتصفحات المختلفة
            if (isKiwiBrowser) {
              // كوكيز بإعدادات متساهلة للمتصفحات المحمولة
              res.cookie('authToken', token, {
                httpOnly: false, // السماح للـ JavaScript بالوصول
                secure: false,   // لا نحتاج HTTPS للتطوير
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
              });

              // كوكيز معرف المستخدم للتحقق السريع
              res.cookie('userId', user.id, {
                httpOnly: false,
                secure: false,
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
              });
            }

            // إضافة headers للتوافق مع جميع المتصفحات
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            // سجل تشخيصي محسن
            console.log('🍪 Enhanced Login Response Debug:', {
              sessionID: req.sessionID ? 'exists' : 'missing',
              isAuthenticated: req.isAuthenticated(),
              sessionUserId: req.session.userId,
              userAgent: userAgent.substring(0, 50) + '...',
              isKiwiBrowser,
              origin: req.headers.origin,
              host: req.headers.host,
              tokenGenerated: 'yes',
              cookiesSet: isKiwiBrowser ? 'enhanced-for-kiwi' : 'standard'
            });

            // الاستجابة مع معلومات إضافية للعميل
            res.json({
              success: true,
              message: 'تم تسجيل الدخول بنجاح',
              token, // التوكن للاستخدام كبديل
              sessionId: req.sessionID, // معرف الجلسة للمراجع
              user: {
                id: user.id,
                username: user.username,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                token: token // إضافة التوكن لكائن المستخدم أيضاً
              },
              // معلومات إضافية للتشخيص
              browserInfo: {
                isKiwi: isKiwiBrowser,
                userAgent: userAgent.substring(0, 100)
              }
            });
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
    // سجل تشخيصي لفهم حالة المصادقة
    console.log('🔍 Auth Check - GET /user:', {
      sessionExists: !!req.session,
      sessionID: req.sessionID ? 'exists' : 'missing', 
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      origin: req.headers.origin,
      cookies: req.headers.cookie ? 'present' : 'none'
    });

    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(sanitizeUser(req.user));
  });
}

// وسطاء للتحقق من المصادقة مع دعم محسن لجميع المتصفحات
export function isAuthenticated(req: any, res: any, next: any) {
  // سجل تشخيصي محسن
  const userAgent = req.headers['user-agent'] || '';
  const isKiwiBrowser = userAgent.toLowerCase().includes('kiwi') || 
                      userAgent.toLowerCase().includes('mobile');

  console.log('🔍 Enhanced Auth Middleware Check:', {
    sessionExists: !!req.session,
    sessionID: req.sessionID ? 'exists' : 'missing',
    sessionUserId: req.session?.userId,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    hasUser: !!req.user,
    isKiwiBrowser,
    userAgent: userAgent.substring(0, 50) + '...',
    origin: req.headers.origin,
    cookies: req.headers.cookie ? 'present' : 'none'
  });

  // 🔧 KIWI COMPATIBILITY: تحقق محسن من الجلسة
  if (req.session && req.session.userId && req.session.isAuthenticated) {
    // إذا كانت الجلسة تحتوي على معرف المستخدم، حاول استرجاع المستخدم
    if (!req.user) {
      // إنشاء كائن مستخدم مؤقت من بيانات الجلسة
      req.user = {
        id: req.session.userId,
        role: req.session.userRole || 'user'
      };
    }
    console.log('✅ Auth via enhanced session for user:', req.session.userId);
    return next();
  }

  // أولاً: تحقق من المصادقة عبر passport الكلاسيكي
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    console.log('✅ Auth via passport session for user:', req.user.id);
    return next();
  }

  // ثانياً: تحقق من التوكن في Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (payload) {
      req.user = {
        id: payload.id,
        username: payload.username,
        role: payload.role
      };
      req.isAuthenticated = () => true;
      console.log('✅ Auth via Authorization Bearer token for user:', payload.username);
      return next();
    }
  }

  // 🔧 KIWI FALLBACK: تحقق من كوكيز التوكن الاحتياطية
  if (isKiwiBrowser) {
    const cookieToken = req.cookies?.authToken;
    const cookieUserId = req.cookies?.userId;

    if (cookieToken) {
      const payload = verifyToken(cookieToken);
      if (payload) {
        req.user = {
          id: payload.id,
          username: payload.username,
          role: payload.role
        };
        req.isAuthenticated = () => true;
        console.log('✅ Auth via Kiwi fallback cookie token for user:', payload.username);
        return next();
      }
    }

    if (cookieUserId) {
      // كحل أخير، استخدم معرف المستخدم من الكوكيز
      req.user = {
        id: cookieUserId,
        role: 'user' // دور افتراضي
      };
      req.isAuthenticated = () => true;
      console.log('✅ Auth via Kiwi userId cookie for user:', cookieUserId);
      return next();
    }
  }

  // رابعاً: تحقق من query parameter (للWebSocket وحالات خاصة)
  if (req.query.token) {
    const payload = verifyToken(req.query.token);
    if (payload) {
      req.user = {
        id: payload.id,
        username: payload.username,
        role: payload.role
      };
      req.isAuthenticated = () => true;
      console.log('✅ Auth via query token for user:', payload.username);
      return next();
    }
  }

  console.log('❌ Auth failed - no valid session, token, or cookies found');
  res.status(401).json({ 
    message: 'Authentication required',
    authenticated: false,
    debugInfo: {
      sessionExists: !!req.session,
      hasUser: !!req.user,
      isKiwiBrowser,
      suggestedFix: isKiwiBrowser ? 'Try using token-based auth' : 'Check cookies and session'
    }
  });
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