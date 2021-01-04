export interface MarketData {
    prices: {
        [key in MarketResourceConstant]?: {
            sell: number;
            buy: number;
        };
    };
}
