use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod betting_exchange {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        title: String,
        description: String,
        expiry_timestamp: i64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.title = title;
        market.description = description;
        market.expiry_timestamp = expiry_timestamp;
        market.is_active = true;
        market.is_resolved = false;
        market.yes_token_supply = 0;
        market.no_token_supply = 0;
        market.bump = ctx.bumps.market;
        
        Ok(())
    }

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        side: Side,
        order_type: OrderType,
        price: u64, // Price in basis points (0-10000, where 10000 = 1.0)
        size: u64,
    ) -> Result<()> {
        let order = &mut ctx.accounts.order;
        order.market = ctx.accounts.market.key();
        order.user = ctx.accounts.user.key();
        order.side = side;
        order.order_type = order_type;
        order.price = price;
        order.size = size;
        order.filled = 0;
        order.status = OrderStatus::Pending;
        order.bump = ctx.bumps.order;

        // Emit order event for off-chain matching engine
        emit!(OrderPlaced {
            order_id: order.key(),
            market: order.market,
            user: order.user,
            side: order.side,
            order_type: order.order_type,
            price: order.price,
            size: order.size,
        });

        Ok(())
    }

    pub fn settle_fill(
        ctx: Context<SettleFill>,
        fill_size: u64,
        fill_price: u64,
    ) -> Result<()> {
        let buy_order = &mut ctx.accounts.buy_order;
        let sell_order = &mut ctx.accounts.sell_order;
        
        // Update filled amounts
        buy_order.filled = buy_order.filled.checked_add(fill_size).unwrap();
        sell_order.filled = sell_order.filled.checked_add(fill_size).unwrap();
        
        // Update order statuses
        if buy_order.filled >= buy_order.size {
            buy_order.status = OrderStatus::Filled;
        } else {
            buy_order.status = OrderStatus::Partial;
        }
        
        if sell_order.filled >= sell_order.size {
            sell_order.status = OrderStatus::Filled;
        } else {
            sell_order.status = OrderStatus::Partial;
        }

        // Mint position tokens to users
        // This would involve CPI calls to SPL Token program
        // Simplified for skeleton

        emit!(FillSettled {
            buy_order: buy_order.key(),
            sell_order: sell_order.key(),
            fill_size,
            fill_price,
        });

        Ok(())
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        outcome: bool, // true for YES, false for NO
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        
        // Only creator can resolve market
        require!(
            market.creator == ctx.accounts.creator.key(),
            ErrorCode::Unauthorized
        );

        // Check if market has expired
        let current_timestamp = Clock::get()?.unix_timestamp;
        require!(
            current_timestamp >= market.expiry_timestamp,
            ErrorCode::MarketNotExpired
        );

        market.is_resolved = true;
        market.resolution = Some(outcome);

        emit!(MarketResolved {
            market: market.key(),
            outcome,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [b"market", creator.key().as_ref(), title.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceOrder<'info> {
    #[account(
        init,
        payer = user,
        space = Order::LEN,
        seeds = [b"order", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub order: Account<'info, Order>,
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleFill<'info> {
    #[account(mut)]
    pub buy_order: Account<'info, Order>,
    #[account(mut)]
    pub sell_order: Account<'info, Order>,
    pub market: Account<'info, Market>,
    /// CHECK: Authority for settlement operations
    pub settlement_authority: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub creator: Signer<'info>,
}

#[account]
pub struct Market {
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub expiry_timestamp: i64,
    pub is_active: bool,
    pub is_resolved: bool,
    pub resolution: Option<bool>,
    pub yes_token_mint: Option<Pubkey>,
    pub no_token_mint: Option<Pubkey>,
    pub yes_token_supply: u64,
    pub no_token_supply: u64,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 8 + 32 + 256 + 512 + 8 + 1 + 1 + 2 + 33 + 33 + 8 + 8 + 1;
}

#[account]
pub struct Order {
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: Side,
    pub order_type: OrderType,
    pub price: u64, // in basis points
    pub size: u64,
    pub filled: u64,
    pub status: OrderStatus,
    pub bump: u8,
}

impl Order {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 1 + 8 + 8 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderType {
    Market,
    Limit,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderStatus {
    Pending,
    Partial,
    Filled,
    Cancelled,
}

// Events
#[event]
pub struct OrderPlaced {
    pub order_id: Pubkey,
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: Side,
    pub order_type: OrderType,
    pub price: u64,
    pub size: u64,
}

#[event]
pub struct FillSettled {
    pub buy_order: Pubkey,
    pub sell_order: Pubkey,
    pub fill_size: u64,
    pub fill_price: u64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub outcome: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized to perform this action")]
    Unauthorized,
    #[msg("Market has not expired yet")]
    MarketNotExpired,
    #[msg("Market is not active")]
    MarketNotActive,
    #[msg("Invalid price range")]
    InvalidPrice,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}
