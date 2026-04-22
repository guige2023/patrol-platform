#!/bin/bash
# API Endpoint Smoke Tests
# Tests key API endpoints to catch routing and configuration issues.
# Run against a running server: bash scripts/test_api_endpoints.sh

BASE_URL="${BASE_URL:-http://localhost:18888}"
API_PREFIX="/api/v1"

echo "Testing API endpoints at $BASE_URL"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

test_endpoint() {
    local method=$1
    local path=$2
    local name=$3
    local expected_code=${4:-200}

    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$API_PREFIX$path" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $name ($method $path) - $http_code"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $name ($method $path) - Expected $expected_code, got $http_code"
        ((FAIL++))
    fi
}

# Login first
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL$API_PREFIX/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗${NC} Login failed - cannot get token"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓${NC} Login successful"
echo ""

# Test knowledge endpoints
echo "Testing Knowledge Endpoints..."
test_endpoint "GET" "/knowledge/" "List knowledge"
test_endpoint "GET" "/knowledge/a2ea3866-3a36-4ab8-aa1e-8796ab75c8d3/attachments" "List attachments"
test_endpoint "GET" "/knowledge/a2ea3866-3a36-4ab8-aa1e-8796ab75c8d3/attachments/test_watermark.pdf" "Preview attachment"
test_endpoint "GET" "/knowledge/a2ea3866-3a36-4ab8-aa1e-8796ab75c8d3/attachments/test_watermark.pdf/download" "Download attachment"

# Test plan endpoints
echo ""
echo "Testing Plan Endpoints..."
test_endpoint "GET" "/plans/" "List plans"
test_endpoint "GET" "/plans/years" "Get plan years"

# Test group endpoints
echo ""
echo "Testing Group Endpoints..."
test_endpoint "GET" "/groups/" "List groups"
# available-cadres requires plan_id parameter, skip for now

# Test unit endpoints
echo ""
echo "Testing Unit Endpoints..."
test_endpoint "GET" "/units/" "List units"
test_endpoint "GET" "/units/tree" "Get unit tree"

# Test cadre endpoints
echo ""
echo "Testing Cadre Endpoints..."
test_endpoint "GET" "/cadres/" "List cadres"

# Test system config endpoints
echo ""
echo "Testing System Config Endpoints..."
test_endpoint "GET" "/system-configs/" "List system configs"

# Test auth endpoints
echo ""
echo "Testing Auth Endpoints..."
test_endpoint "GET" "/auth/me" "Get current user"

# Test draft endpoints
echo ""
echo "Testing Draft Endpoints..."
test_endpoint "GET" "/drafts/" "List drafts"

# Test clue endpoints
echo ""
echo "Testing Clue Endpoints..."
test_endpoint "GET" "/clues/" "List clues"

# Test rectification endpoints
echo ""
echo "Testing Rectification Endpoints..."
test_endpoint "GET" "/rectifications/" "List rectifications"

# Test notification endpoints
echo ""
echo "Testing Notification Endpoints..."
test_endpoint "GET" "/notifications/" "List notifications"

# Test warning endpoints
echo ""
echo "Testing Warning Endpoints..."
test_endpoint "GET" "/warnings/" "List warnings"
test_endpoint "GET" "/warnings/unread-count" "Get unread count"

# Test search endpoints
echo ""
echo "Testing Search Endpoints..."
test_endpoint "GET" "/search/?q=test" "Search"

# Summary
echo ""
echo "=========================================="
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"

if [ $FAIL -gt 0 ]; then
    exit 1
else
    exit 0
fi
