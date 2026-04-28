#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "=== Backend Tests ==="
cd backend && pytest
echo "=== Frontend Lint ==="
cd ../frontend && npm run lint
echo "=== Frontend Build ==="
npm run build
echo "=== All checks passed ==="
