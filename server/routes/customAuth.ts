
import express from 'express';
import { registerUser, loginUser, verifyEmailToken, refreshUserToken } from '../auth/customAuth';
import { authenticateCustom, AuthenticatedRequest } from '../middleware/customAuth';

const router = express.Router();

// تسجيل حساب جديد
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور والاسم الأول مطلوبة'
      });
    }

    const result = await registerUser({
      email,
      password,
      firstName,
      lastName
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Registration route error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    const result = await loginUser(email, password, {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }

  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// تحديث الرمز المميز
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'رمز التجديد مطلوب'
      });
    }

    const result = await refreshUserToken(refreshToken);

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }

  } catch (error) {
    console.error('Token refresh route error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// التحقق من البريد الإلكتروني
router.post('/verify-email', async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم ورمز التحقق مطلوبان'
      });
    }

    const result = await verifyEmailToken(userId, token);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Email verification route error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// الحصول على معلومات المستخدم الحالي
router.get('/me', authenticateCustom, async (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// تسجيل الخروج
router.post('/logout', authenticateCustom, async (req: AuthenticatedRequest, res) => {
  // يمكن إضافة منطق إبطال الرموز هنا
  res.json({
    success: true,
    message: 'تم تسجيل الخروج بنجاح'
  });
});

export default router;
