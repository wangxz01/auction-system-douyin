# Auction Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persistent multi-user auction live comments with recent history and WebSocket `new_comment` broadcasts.

**Architecture:** Store comments in MySQL with a new `models.Comment` table. Add REST endpoints beside existing auction child resources, reuse JWT auth for posting, and reuse the existing per-auction WebSocket Hub for live delivery. Update the live room frontend to load recent comments, send comments through the API, and append `new_comment` events.

**Tech Stack:** Go, Gin, GORM, MySQL, Gorilla WebSocket, React, TypeScript, Vite, axios.

---

### Task 1: Backend Comment API and Broadcast

**Files:**
- Create: `backend/models/comment.go`
- Create: `backend/controllers/comment_test.go`
- Create: `backend/controllers/comment.go`
- Modify: `backend/config/db.go`
- Modify: `backend/routes/routes.go`

- [ ] **Step 1: Write failing backend tests**

Add tests covering:

- Authenticated `POST /api/auctions/:id/comments` stores a comment and broadcasts `new_comment`.
- Empty comment content is rejected with 400.
- `GET /api/auctions/:id/comments?limit=2` returns the latest two comments in oldest-first display order.

Run:

```bash
cd backend
GOCACHE=/private/tmp/auction-go-cache go test ./controllers
```

Expected: FAIL because comment model and handlers do not exist.

- [ ] **Step 2: Implement model and migration**

Create `models.Comment` with `AuctionID`, `UserID`, `Username`, `Content`, and `CreatedAt`. Add it to `config.InitDB` `AutoMigrate`.

- [ ] **Step 3: Implement handlers**

Create `GetComments` and `CreateComment`.

Rules:

- Parse auction id with existing `parseID`.
- `GET` accepts `limit`, default 30, max 100.
- `GET` loads newest records from DB, reverses them to oldest-first.
- `POST` requires auth middleware context.
- `POST` trims content, rejects empty content, max 100 characters.
- `POST` verifies the auction exists.
- `POST` loads the authenticated user to capture username.
- `POST` writes the comment and broadcasts `new_comment`.

- [ ] **Step 4: Register routes**

Add public:

```go
api.GET("/auctions/:id/comments", controllers.GetComments)
```

Add authenticated:

```go
auth.POST("/auctions/:id/comments", controllers.CreateComment)
```

- [ ] **Step 5: Verify backend**

Run:

```bash
cd backend
GOCACHE=/private/tmp/auction-go-cache go test ./...
```

Expected: PASS.

### Task 2: Frontend Comment Integration

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/pages/AuctionDetail.tsx`

- [ ] **Step 1: Add frontend types**

Add `Comment` and extend `WSMessage` with `new_comment`.

- [ ] **Step 2: Replace fake comments**

Remove `FAKE_COMMENTS` and the interval that generates local comments.

- [ ] **Step 3: Load history**

During initial auction load, call:

```ts
api.get<{ data: AuctionComment[] }>(`/auctions/${auctionId}/comments`)
```

Store comments as structured objects.

- [ ] **Step 4: Send comments through API**

Update `sendComment` to:

- Redirect to login if unauthenticated.
- POST `{ content }` to `/auctions/:id/comments`.
- Let the WebSocket event append the comment.
- Clear and close the input on success.

- [ ] **Step 5: Append WebSocket comments**

In `handleMessage`, handle `new_comment` by appending `msg.comment` and keeping a bounded local list.

- [ ] **Step 6: Verify frontend**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

`npm run lint` currently has pre-existing React Hooks rule failures. Run it after the build and report whether any new comment-related failures appear.

### Task 3: Manual Integration Check

**Files:**
- No production file edits expected.

- [ ] **Step 1: Ensure backend is running**

The user already started the backend. If needed, run:

```bash
cd backend
go run ./cmd/server
```

- [ ] **Step 2: Ensure frontend dev server is running**

Frontend is available at:

```text
http://127.0.0.1:5173/
```

- [ ] **Step 3: Smoke-test API shape**

Use curl or browser flow to verify:

- Login/register gets a token.
- Posting a comment returns the stored comment.
- Reloading the room shows recent comments.
- Another connected browser receives `new_comment`.
