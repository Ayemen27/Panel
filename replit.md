# Web-based Server Management Platform

## Overview

This is a comprehensive server management web application built for Linux system administration. The platform provides a unified interface for managing applications, domains, SSL certificates, Nginx configurations, and system monitoring. It's designed to simplify DevOps tasks through an intuitive web dashboard with real-time updates and automation capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern component patterns
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management with automatic caching and synchronization
- **UI Framework**: Shadcn/ui components built on Radix UI primitives for accessibility and consistency
- **Styling**: Tailwind CSS with custom design system using CSS variables for theming
- **Build Tool**: Vite for fast development and optimized production builds
- **Real-time Updates**: WebSocket integration for live system monitoring and notifications

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for full-stack type safety
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe database operations
- **Authentication**: Replit's OpenID Connect (OIDC) authentication system with Passport.js
- **Session Management**: Express sessions with PostgreSQL store for persistence
- **API Design**: RESTful API with consistent error handling and logging middleware

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for database migrations and schema versioning
- **Session Storage**: PostgreSQL table for authentication session persistence
- **File System**: Direct server file system access for configuration files and logs

### System Integration Services
- **Process Management**: PM2 service integration for application lifecycle management
- **Web Server**: Nginx configuration management with syntax validation
- **SSL Management**: Let's Encrypt certificate automation with renewal tracking
- **System Monitoring**: Direct system calls for resource monitoring and process inspection
- **Log Management**: Centralized logging from multiple sources (applications, system, web server)

### Real-time Features
- **WebSocket Server**: Integrated WebSocket server for real-time dashboard updates
- **Live Monitoring**: Continuous system resource monitoring with periodic updates
- **Notification System**: Real-time alerts and status updates pushed to connected clients
- **Live Log Streaming**: Real-time log tailing capabilities for debugging and monitoring

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database hosting with connection pooling
- **Database URL**: Environment-based configuration for database connectivity

### Authentication Provider
- **Replit OIDC**: OpenID Connect authentication integration for secure user management
- **Session Security**: Secure session management with configurable expiration

### System Dependencies
- **PM2**: Process manager for Node.js applications with clustering and monitoring
- **Nginx**: Web server and reverse proxy for application hosting and SSL termination
- **Certbot**: Let's Encrypt client for automated SSL certificate management
- **System Commands**: Direct shell command execution for system administration tasks

### Development Tools
- **Replit Platform**: Integrated development environment with live preview capabilities
- **Vite Plugins**: Replit-specific plugins for error handling, cartographer, and development banners
- **TypeScript**: Full-stack type checking and modern JavaScript features

### UI and Styling
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Tailwind CSS**: Utility-first styling with custom design tokens
- **Lucide Icons**: Consistent icon library for interface elements
- **Google Fonts**: Web fonts for typography (Inter, DM Sans, Fira Code, Geist Mono)

### Monitoring and Utilities
- **Date-fns**: Date manipulation with internationalization support (Arabic locale)
- **Wouter**: Lightweight routing without the complexity of React Router
- **Class Variance Authority**: Type-safe component variant management
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema parsing