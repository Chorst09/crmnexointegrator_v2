#!/bin/bash

# CRM Setup Script
echo "🚀 Setting up CRM Comercial..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Install dependencies
print_info "Installing dependencies..."

# Frontend dependencies
print_info "Installing frontend dependencies..."
cd frontend
if [ ! -f "package.json" ]; then
    print_error "Frontend package.json not found!"
    exit 1
fi
npm install
cd ..

# Backend dependencies
print_info "Installing backend dependencies..."
cd backend
if [ ! -f "package.json" ]; then
    print_error "Backend package.json not found!"
    exit 1
fi
npm install
cd ..

print_status "Dependencies installed successfully!"

# Setup environment files
print_info "Setting up environment files..."

# Frontend .env
if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    print_status "Created frontend/.env from example"
else
    print_warning "frontend/.env already exists"
fi

# Backend .env
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    print_status "Created backend/.env from example"
else
    print_warning "backend/.env already exists"
fi

# Database setup
print_info "Setting up database..."

# Ask user which database to use
echo ""
echo "Which database would you like to use?"
echo "1) Neon PostgreSQL (Recommended for production)"
echo "2) Local SQLite (For development)"
read -p "Enter your choice (1-2): " db_choice

case $db_choice in
    1)
        print_info "Setting up Neon PostgreSQL..."
        echo "DATABASE_TYPE=postgresql" >> backend/.env
        echo ""
        print_warning "Please update your backend/.env file with your Neon database URL:"
        print_info "NEON_DATABASE_URL=\"postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require\""
        ;;
    2)
        print_info "Setting up Local SQLite..."
        echo "DATABASE_TYPE=sqlite" >> backend/.env
        echo "DATABASE_URL=\"file:./dev.db\"" >> backend/.env
        ;;
    *)
        print_error "Invalid choice. Defaulting to Local SQLite."
        echo "DATABASE_TYPE=sqlite" >> backend/.env
        echo "DATABASE_URL=\"file:./dev.db\"" >> backend/.env
        ;;
esac

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "your-super-secret-jwt-key-$(date +%s)")
echo "JWT_SECRET=\"$JWT_SECRET\"" >> backend/.env
print_status "Generated JWT secret"

# Setup Prisma
print_info "Setting up Prisma..."
cd backend

# Copy appropriate schema
if [ "$db_choice" = "1" ]; then
    cp ../database/neon/schema.prisma prisma/schema.prisma
    print_status "Copied Neon PostgreSQL schema"
elif [ "$db_choice" = "2" ]; then
    cp ../database/neon/schema.prisma prisma/schema.prisma
    # Modify for SQLite compatibility
    sed -i.bak 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
    sed -i.bak 's/env("NEON_DATABASE_URL")/env("DATABASE_URL")/' prisma/schema.prisma
    print_status "Copied and modified schema for SQLite"
else
    cp ../database/neon/schema.prisma prisma/schema.prisma
    sed -i.bak 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
    sed -i.bak 's/env("NEON_DATABASE_URL")/env("DATABASE_URL")/' prisma/schema.prisma
    print_status "Copied and modified schema for SQLite"
fi

# Generate Prisma client
npm run db:generate
print_status "Generated Prisma client"

# Run migrations (only for local development)
if [ "$db_choice" = "2" ]; then
    print_info "Running database migrations..."
    npm run db:push
    print_status "Database migrations completed"
    
    print_info "Seeding database..."
    npm run db:seed
    print_status "Database seeded with sample data"
fi

cd ..

# Create uploads directory
mkdir -p backend/uploads
print_status "Created uploads directory"

# Final instructions
echo ""
print_status "Setup completed successfully! 🎉"
echo ""
print_info "Next steps:"
echo "1. Update your environment files with your actual configuration"
echo "2. If using Neon, run the database migrations manually"
echo "3. Start the development servers:"
echo ""
echo "   # Terminal 1 - Backend"
echo "   cd backend && npm run dev"
echo ""
echo "   # Terminal 2 - Frontend"
echo "   cd frontend && npm run dev"
echo ""
echo "4. Access the application at http://localhost:3000"
echo "5. Login with: admin@crm.com / admin123"
echo ""
print_warning "Don't forget to update your .env files with real credentials!"
echo ""
print_status "Happy coding! 🚀"
