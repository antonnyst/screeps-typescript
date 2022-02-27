/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { MARKET_RESOURCES, RESOURCE_LIMITS, RESOURCE_TYPE } from "../config/constants";
import { Manager } from "./manager";
import { RunEvery } from "utils/RunEvery";
import { Terminal } from "buildings";
import { isOwnedRoom } from "../utils/RoomCalc";

declare global {
  interface Memory {
    marketData: MarketData;
  }
}

export interface MarketData {
  prices: {
    [key in MarketResourceConstant]?: {
      sell: number;
      buy: number;
    };
  };
}

export class ResourceManager implements Manager {
  public minSpeed = 0.2;
  public maxSpeed = 1;
  public run(speed: number): void {
    RunEvery(
      () => {
        const TerminalRooms: string[] = [];
        for (const r in Game.rooms) {
          const room = Game.rooms[r];
          if (isOwnedRoom(room) && room.memory.resources !== undefined && Terminal(room) !== null) {
            TerminalRooms.push(r);
          }
        }
        const usedRooms: string[] = [];
        if (TerminalRooms.length > 0) {
          for (const resource of _.clone(RESOURCES_ALL).reverse()) {
            const resourceType = RESOURCE_TYPE[resource];

            const needRooms: { roomName: string; amt: number }[] = [];
            const haveRooms: { roomName: string; amt: number }[] = [];

            for (const r of TerminalRooms) {
              const room = Game.rooms[r];
              if (isOwnedRoom(room)) {
                const a = room.memory.resources!.delta[resource];
                if (a < 0) {
                  needRooms.push({
                    roomName: r,
                    amt: a
                  });
                } else if (a > 0 && Game.rooms[r].terminal!.cooldown === 0 && !usedRooms.includes(r)) {
                  haveRooms.push({
                    roomName: r,
                    amt: a
                  });
                }
              }
            }

            if (haveRooms.length > 0 && needRooms.length > 0) {
              // We can redistrubute this resource
              for (const nr of needRooms) {
                // Find the closest room that can supply this resource
                const sr = _.sortBy(haveRooms, (hr: { roomName: string; amt: number }) =>
                  Game.map.getRoomLinearDistance(nr.roomName, hr.roomName)
                )[0];

                const amt: number | undefined = Game.rooms[sr.roomName].terminal?.store.getUsedCapacity(resource);

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
                usedRooms.push(sr.roomName);
              }
            } else if (
              haveRooms.length > 0 &&
              needRooms.length === 0 &&
              resourceType !== undefined &&
              RESOURCE_LIMITS[resourceType].room.sell !== null
            ) {
              // We have too much of this resource
              for (const hr of haveRooms) {
                const excess =
                  hr.amt - (RESOURCE_LIMITS[resourceType].room.sell! - RESOURCE_LIMITS[resourceType].room.export);
                const terminalAmount = Game.rooms[hr.roomName].terminal?.store.getUsedCapacity(resource);
                if (excess > 0 && terminalAmount !== undefined) {
                  // This room has this much excess we can sell
                  const amt: number = Math.min(terminalAmount, excess);

                  let orders: Order[] = Game.market.getAllOrders({
                    type: ORDER_BUY,
                    resourceType: resource
                  });

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
                    usedRooms.push(hr.roomName);
                  }
                }
              }
            }
          }
        }
      },
      "resourcemanagerrunterminals",
      10 / speed
    );

    if (Memory.marketData === undefined) {
      Memory.marketData = {
        prices: {}
      };
    }

    RunEvery(
      () => {
        for (const resource of MARKET_RESOURCES) {
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
      3000 / speed
    );
  }
}
