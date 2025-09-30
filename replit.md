# Overview

This is a server control panel application built as a full-stack TypeScript project for managing server applications, domains, SSL certificates, Nginx configurations, and system monitoring. The application provides a comprehensive interface for server administration with real-time monitoring capabilities through WebSocket connections.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Library**: Radix UI components with Tailwind CSS styling
- **State Management**: TanStack Query for server state and React Context for client state
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode)

## Backend Architecture
- **Runtime**: Node.js with TypeScript and ES modules
- **Framework**: Express.js for HTTP server and API routes
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy and bcrypt for password hashing
- **Session Management**: Express sessions with database storage
- **WebSocket**: Native WebSocket server for real-time communication

## Core Design Patterns
- **Service Layer Architecture**: All business logic encapsulated in services inheriting from BaseService
- **Dependency Injection**: ServiceContainer manages service lifecycle and dependencies
- **Unified Response Handling**: ResponseHandler provides consistent API responses
- **Error Management**: Centralized error handling with ServiceError for typed errors

## Service Architecture
The system uses a unified service pattern where all services extend BaseService:
- **SystemService**: System monitoring and statistics
- **PM2Service**: Process management with fallback for environments without PM2
- **NginxService**: Web server configuration management
- **UnifiedFileService**: File system operations with security validation
- **UnifiedNotificationService**: Centralized notification management
- **AuditService**: Comprehensive application auditing and health checks

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Comprehensive schema covering users, applications, domains, SSL certificates, system logs, and file management
- **Migration System**: Structured migration files for database evolution
- **Connection Management**: Smart connection pooling with health monitoring

## Security Architecture
- **Authentication**: Username/password with secure session management
- **Authorization**: Role-based access control (admin, moderator, user, viewer)
- **Rate Limiting**: Multiple tiers of rate limiting for different endpoint types
- **Input Validation**: Zod schemas for all data validation
- **SSL Support**: Integrated SSL certificate management with Let's Encrypt

## Real-time Features
- **WebSocket Server**: Built-in WebSocket support for live updates
- **System Monitoring**: Real-time CPU, memory, and disk usage tracking
- **Log Streaming**: Live application and system log viewing
- **Notifications**: Real-time notification delivery to connected clients

## Environment Configuration
- **Multi-environment Support**: Development, production, and Replit-specific configurations
- **Smart Environment Detection**: Automatic detection of hosting environment
- **Path Management**: Flexible path configuration with automatic directory creation
- **SSL Configuration**: Environment-specific SSL settings with security validation

# External Dependencies

## Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver for Neon database connections
- **drizzle-orm**: Type-safe ORM for database operations
- **express**: Web framework for HTTP server and API routes
- **passport**: Authentication middleware with local strategy support

## Frontend Dependencies
- **@radix-ui/***: Comprehensive UI component library for accessible interfaces
- **@tanstack/react-query**: Server state management and caching
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight routing library for React

## Development Tools
- **tsx**: TypeScript execution for development
- **vite**: Fast build tool and development server
- **typescript**: Type checking and compilation

## System Integration
- **PM2**: Process management (optional, with fallback implementation)
- **Nginx**: Web server configuration (optional, graceful degradation)
- **Let's Encrypt**: SSL certificate automation via certbot

## Database Services
- **PostgreSQL**: Primary database with SSL support
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## Security & Validation
- **bcryptjs**: Password hashing
- **express-rate-limit**: API rate limiting protection
- **zod**: Runtime type validation and schema enforcement

## Monitoring & Logging
- **ws**: WebSocket server implementation for real-time features
- **memoizee**: Function memoization for performance optimization