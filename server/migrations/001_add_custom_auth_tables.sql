
-- إنشاء جداول المصادقة المخصصة
CREATE TABLE IF NOT EXISTS auth_users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR,
  role VARCHAR DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  email_verified_at TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_user_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  device_id VARCHAR,
  session_token VARCHAR UNIQUE NOT NULL,
  device_fingerprint VARCHAR,
  user_agent TEXT,
  ip_address VARCHAR,
  location_data JSONB,
  device_name VARCHAR,
  browser_name VARCHAR,
  browser_version VARCHAR,
  os_name VARCHAR,
  os_version VARCHAR,
  device_type VARCHAR DEFAULT 'web',
  login_method VARCHAR DEFAULT 'password',
  access_token_hash VARCHAR,
  refresh_token_hash VARCHAR,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT NOW(),
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoked_reason VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token VARCHAR UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_user_sessions_user_id ON auth_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_sessions_session_token ON auth_user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
