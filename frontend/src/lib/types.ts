export type AuctionStatus = 'pending' | 'active' | 'finished' | 'cancelled'

export interface Auction {
  id: number
  title: string
  description: string
  image_url: string
  start_price: number
  price_step: number
  ceiling_price: number | null
  current_price: number
  duration_seconds: number
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
  created_at: string
}

export interface Order {
  id: number
  auction_id: number
  user_id: number
  final_price: number
  status: string
  created_at: string
  updated_at: string
}

export interface TopBid {
  user_id: number
  amount: number
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

export type WSMessage =
  | { type: 'auction_started'; auction_id: number; ends_at: string }
  | {
      type: 'new_bid'
      auction_id: number
      current_price: number
      winner_id: number
      ends_at: string
      top_bids: TopBid[]
    }
  | {
      type: 'auction_finished'
      auction_id: number
      final_price: number
      winner_id: number | null
    }
  | { type: 'auction_cancelled'; auction_id: number }
