.PHONY: up down logs test reset
up:    ; docker compose up --build -d
down:  ; docker compose down
logs:  ; docker compose logs -f
reset: ; docker compose down -v
test:  ; cd backend && pip install -r requirements.txt -q && pytest -q
