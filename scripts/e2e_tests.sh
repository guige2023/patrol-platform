#!/bin/bash
# E2E Smoke Tests - Tests key user flows
# Run with: bash scripts/e2e_tests.sh

BASE_URL="${BASE_URL:-http://localhost:3070}"
API_URL="${API_URL:-http://localhost:18888}"

echo "E2E Smoke Tests"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

# Test 1: Frontend loads
echo ""
echo "Test 1: Frontend loads..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Frontend loads successfully"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Frontend failed to load (HTTP $HTTP_CODE)"
    ((FAIL++))
fi

# Test 2: Backend API loads
echo ""
echo "Test 2: Backend API loads..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/openapi.json")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Backend API loads successfully"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Backend API failed to load (HTTP $HTTP_CODE)"
    ((FAIL++))
fi

# Test 3: Login works
echo ""
echo "Test 3: Login works..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC} Login successful"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Login failed"
    ((FAIL++))
fi

# Test 4: Create a plan (if TOKEN is available)
if [ -n "$TOKEN" ]; then
    echo ""
    echo "Test 4: Can create a draft plan..."

    # Get max round number
    PLANS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/v1/plans/" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data.get('data', {}).get('items', [])
current_year = 2026
same_year = [p for p in items if str(p.get('year', '')) == str(current_year)]
max_round = max([p.get('round', 0) for p in same_year] or [0])
print(max_round)
" 2>/dev/null)

    NEXT_ROUND=$((PLANS + 1))
    YEAR=$(date +%Y)

    CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/plans/" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"E2E Test Plan $(date +%s)\",\"year\":$YEAR,\"round\":$NEXT_ROUND,\"inspection_type\":\"regular\",\"start_date\":\"${YEAR}-03-01\",\"end_date\":\"${YEAR}-05-31\"}")

    PLAN_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') or '')" 2>/dev/null)

    if [ -n "$PLAN_ID" ]; then
        echo -e "${GREEN}✓${NC} Can create a draft plan (ID: $PLAN_ID)"
        ((PASS++))

        # Cleanup: delete the test plan
        curl -s -X DELETE "$API_URL/api/v1/plans/$PLAN_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
    else
        echo -e "${RED}✗${NC} Failed to create plan"
        echo "Response: $CREATE_RESPONSE"
        ((FAIL++))
    fi
fi

# Test 5: Knowledge attachment download works
echo ""
echo "Test 5: Knowledge attachment download..."
DOWNLOAD_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/e2e_test_download.pdf \
    "$API_URL/api/v1/knowledge/a2ea3866-3a36-4ab8-aa1e-8796ab75c8d3/attachments/test_watermark.pdf/download" \
    -H "Authorization: Bearer $TOKEN")

if [ "$DOWNLOAD_RESPONSE" = "200" ]; then
    FILE_TYPE=$(file /tmp/e2e_test_download.pdf | grep -o "PDF\|JSON\|HTML" || echo "unknown")
    if [ "$FILE_TYPE" = "PDF" ]; then
        echo -e "${GREEN}✓${NC} Knowledge attachment download works"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} Download returned wrong file type: $FILE_TYPE"
        ((FAIL++))
    fi
else
    echo -e "${RED}✗${NC} Knowledge attachment download failed (HTTP $DOWNLOAD_RESPONSE)"
    ((FAIL++))
fi

# Summary
echo ""
echo "=========================================="
echo -e "E2E Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"

if [ $FAIL -gt 0 ]; then
    exit 1
else
    exit 0
fi
