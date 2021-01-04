import { RunEvery } from "utils/RunEvery";
import * as C from "../config/constants";
import { Manager } from "./manager";

export class ResourceManager implements Manager {
    public run() {
        RunEvery(
            () => {
                const TerminalRooms: string[] = [];
                for (const r in Game.rooms) {
                    if (
                        Memory.rooms[r] !== undefined &&
                        Memory.rooms[r].resources !== undefined &&
                        Game.rooms[r].terminal !== undefined
                    ) {
                        TerminalRooms.push(r);
                    }
                }

                for (const resource of RESOURCES_ALL) {
                    const needRooms: { roomName: string; amt: number }[] = [];
                    const haveRooms: { roomName: string; amt: number }[] = [];

                    for (const r of TerminalRooms) {
                        const a = Memory.rooms[r].resources!.delta[resource];
                        if (a < 0) {
                            needRooms.push({
                                roomName: r,
                                amt: a
                            });
                        } else if (a > 0) {
                            haveRooms.push({
                                roomName: r,
                                amt: a
                            });
                        }
                    }

                    if (haveRooms.length > 0 && needRooms.length > 0) {
                        // We can redistrubute this resource
                        for (const nr of needRooms) {
                            // Find the closest room that can supply this resource
                            const sr = _.sortBy(haveRooms, (hr: { roomName: string; amt: number }) =>
                                Game.map.getRoomLinearDistance(nr.roomName, hr.roomName)
                            )[0];

                            const amt: number | undefined = Game.rooms[sr.roomName].terminal?.store.getUsedCapacity(
                                resource
                            );

                            if (amt === undefined) {
                                continue;
                            }

                            let possibleAmount = Math.min(-nr.amt, amt);

                            if (resource === RESOURCE_ENERGY) {
                                // Special calculation due to energy fees
                                const fee = Game.market.calcTransactionCost(1, nr.roomName, sr.roomName);

                                const maxAmt = Math.floor(amt / (1 + fee));
                                possibleAmount = Math.min(maxAmt, -nr.amt);
                            }

                            Game.rooms[sr.roomName].terminal!.send(resource, possibleAmount, nr.roomName);
                        }
                    } else if (
                        haveRooms.length > 0 &&
                        needRooms.length === 0 &&
                        (C.TERMINAL_MINERALS.includes(resource) || resource === RESOURCE_ENERGY)
                    ) {
                        // We have too much of this resource
                        for (const hr of haveRooms) {
                            // This room has this much excess we can sell
                            const amt: number | undefined = Game.rooms[hr.roomName].terminal?.store.getUsedCapacity(
                                resource
                            );

                            if (amt === undefined) {
                                continue;
                            }

                            let orders: Order[] = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: resource });

                            orders = orders.filter((o: Order) => o.price > 0.02);

                            if (orders.length > 0) {
                                const order: Order = _.sortBy(orders, (o: Order) => -o.price)[0];

                                let possibleAmount = Math.min(amt, order.remainingAmount);

                                if (resource === RESOURCE_ENERGY) {
                                    // Special calculation due to energy fees
                                    const fee = Game.market.calcTransactionCost(1, order.roomName!, hr.roomName);
                                    const maxAmt = Math.floor(amt / (1 + fee));
                                    possibleAmount = Math.min(maxAmt, order.remainingAmount);
                                }

                                Game.market.deal(order.id, possibleAmount, hr.roomName);
                            }
                        }
                    }
                }
            },
            "resourcemanagerrunterminals",
            10
        );

        RunEvery(
            () => {
                if (Memory.marketData === undefined) {
                    Memory.marketData = {
                        prices: {}
                    };
                }
                for (const resource of C.MARKET_RESOURCES) {
                    if (Memory.marketData.prices[resource] === undefined) {
                        Memory.marketData.prices[resource] = {
                            sell: 0,
                            buy: 0
                        };
                    }
                    const sellOrders = Game.market.getAllOrders({
                        type: ORDER_SELL,
                        resourceType: resource
                    });
                    const buyOrders = Game.market.getAllOrders({
                        type: ORDER_BUY,
                        resourceType: resource
                    });
                    if (sellOrders.length > 0) {
                        sellOrders.sort((a, b) => a.price - b.price);
                        Memory.marketData.prices[resource]!.sell = sellOrders[0].price;
                    }
                    if (buyOrders.length > 0) {
                        buyOrders.sort((a, b) => b.price - a.price);
                        Memory.marketData.prices[resource]!.buy = buyOrders[0].price;
                    }
                }
            },
            "resourcemanagerrunmarket",
            3000
        );
    }
}
