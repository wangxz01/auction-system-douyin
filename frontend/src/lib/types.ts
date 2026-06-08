export type AuctionStatus = 'pending' | 'active' | 'finished' | 'cancelled'

export interface Auction {
  id: number
  seller_user_id: number
  title: string
  description: string
  image_url: string
  stream_url: string
  start_price: number
  start_price_cents: number
  price_step: number
  price_step_cents: number
  ceiling_price: number | null
  ceiling_price_cents: number | null
  current_price: number
  current_price_cents: number
  duration_seconds: number
  auto_extend_seconds: number
  status: AuctionStatus
  winner_id: number | null
  started_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export interface Bid {
  id: number
  auction_id: number
  user_id: number
  amount: number
  amount_cents: number
  created_at: string
}

export interface Order {
  id: number
  auction_id: number
  user_id: number
  final_price: number
  final_price_cents: number
  status: string
  created_at: string
  updated_at: string
}

export interface AuctionComment {
  id: number
  auction_id: number
  user_id: number
  username: string
  content: string
  created_at: string
}

export interface TopBid {
  user_id: number
  amount: number
  amount_cents: number
}

export interface MyBidEntry {
  auction: Auction
  my_highest_bid: number
  my_bid_count: number
  is_leading: boolean
}

export interface MyOrderEntry {
  order: Order
  auction: Auction
}

export interface AdminOrderEntry {
  order: Order
  auction: Auction
}

export type WSMessage =
  | { type: 'auction_started'; auction_id: number; ends_at: string }
  | {
      type: 'new_bid'
      auction_id: number
      current_price: number
      current_price_cents: number
      winner_id: number
      ends_at: string
      top_bids: TopBid[]
    }
  | {
      type: 'auction_finished'
      auction_id: number
      final_price: number
      final_price_cents: number
      winner_id: number | null
    }
  | {
      type: 'new_comment'
      auction_id: number
      comment: AuctionComment
    }
  | { type: 'auction_cancelled'; auction_id: number }
