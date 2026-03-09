#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# --- Backend ---
echo -e "${GREEN}Starting backend...${NC}"

if [ ! -d "$ROOT_DIR/backend/venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv "$ROOT_DIR/backend/venv"
fi

source "$ROOT_DIR/backend/venv/bin/activate"
pip install -q -r "$ROOT_DIR/backend/requirements.txt"

cd "$ROOT_DIR/backend/src"
python run.py &
BACKEND_PID=$!
cd "$ROOT_DIR"

# --- Frontend ---
echo -e "${GREEN}Starting frontend...${NC}"

cd "$ROOT_DIR/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}  Backend:  http://localhost:5001${NC}"
echo -e "${GREEN}  Frontend: http://localhost:3000${NC}"
echo -e "${GREEN}==================================${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop both${NC}"
echo ""

wait
