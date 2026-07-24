#!/bin/bash

# Exit on error
set -e

echo "=== Starting Gold AI Signal Production Server ==="

# Check if .env exists
if [ ! -f .env ]; then
  echo "Error: .env file not found!"
  exit 1
fi

echo "Generating Prisma Client..."
npx prisma generate

echo "Applying Database Schema..."
npx prisma db push

echo "Building Next.js Application..."
npm run build

echo "Starting Next.js Server on port 3000..."
PORT=3000 npm run start
