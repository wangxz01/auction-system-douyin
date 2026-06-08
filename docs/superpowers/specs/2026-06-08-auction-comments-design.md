# Auction Comments Design

## Goal

Add real multi-user comments to auction live rooms. Comments should be stored in MySQL, visible to users who enter or refresh a room, and delivered live to connected clients through the existing auction WebSocket room.

## Backend

Add a `comments` table with:

- `id`
- `auction_id`
- `user_id`
- `username`
- `content`
- `created_at`

Add an index for `auction_id, created_at` so recent comments for one auction can be loaded efficiently.

Add two REST endpoints:

- `GET /api/auctions/:id/comments?limit=30`
  - Public.
  - Returns recent comments for the auction, oldest first for display.
  - Default limit is 30; maximum is 100.
- `POST /api/auctions/:id/comments`
  - Requires JWT auth.
  - Body: `{ "content": "..." }`.
  - Trims whitespace, rejects empty content, and limits content to 100 characters.
  - Verifies the auction exists.
  - Stores the comment with the authenticated user id and username.
  - Broadcasts `new_comment` to the auction WebSocket room.

WebSocket event shape:

```json
{
  "type": "new_comment",
  "auction_id": 1,
  "comment": {
    "id": 10,
    "auction_id": 1,
    "user_id": 2,
    "username": "adam",
    "content": "这个不错",
    "created_at": "2026-06-08T20:00:00+08:00"
  }
}
```

## Frontend

Update `AuctionDetail` so comments come from the backend:

- Load `GET /api/auctions/:id/comments` during initial room load.
- Send comments through `POST /api/auctions/:id/comments`.
- Append comments when a `new_comment` WebSocket message arrives.
- Remove the fake local comment timer.
- Keep the existing comment bubble layout, displaying `username: content`.

## Testing

Backend tests should cover:

- Posting a valid authenticated comment stores it and broadcasts `new_comment`.
- Posting empty content is rejected.
- Getting recent comments returns the newest limited set in display order.

Frontend validation is covered by TypeScript build and the existing Vite build. The current lint command has unrelated React Hooks rule failures that already existed before this work.
