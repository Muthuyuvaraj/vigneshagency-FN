import { Dealer, Bill, Transaction } from "./types";

const ISO = (d: string) => `${d}T00:00:00.000Z`;

export const dealers: Dealer[] = [
  { id: "d1", dealerCode: "101", name: "Ramesh Stores", phone: "9876543210", area: "Uthrakosamangai", balance: 2500 },
  { id: "d2", dealerCode: "102", name: "Suresh Babu", phone: "9876543211", area: "T. Nagar", balance: 1200 },
  { id: "d3", dealerCode: "103", name: "Lakshmi Stores", phone: "9876543212", area: "Adyar", balance: 0 },
  { id: "d4", dealerCode: "104", name: "Ganesh Milk Center", phone: "9876543213", area: "Velachery", balance: 3400 },
  { id: "d5", dealerCode: "105", name: "Priya Dairy", phone: "9876543214", area: "Tambaram", balance: 800 },
  { id: "d6", dealerCode: "106", name: "Murugan Stores", phone: "9876543215", area: "Chromepet", balance: 1500 },
];

export const bills: Bill[] = [
  {
    id: "b1",
    dealerMongoId: "d1",
    dealerId: "101",
    dealerName: "Ramesh Stores",
    dealerCode: "101",
    dealerArea: "Uthrakosamangai",
    dealerPhone: "9876543210",
    date: "2026-04-07",
    items: [
      {
        name: "Full Cream Milk",
        size: "500ml",
        price: 69.8,
        litersPerCrate: 14,
        qty: 1,
      },
      {
        name: "Fresh Curd",
        size: "200ml",
        price: 22,
        litersPerCrate: 5,
        qty: 1,
      },
    ],
    total: 1087.2,
    status: "pending",
  },
  {
    id: "b2",
    dealerMongoId: "d2",
    dealerId: "102",
    dealerName: "Suresh Babu",
    dealerCode: "102",
    dealerArea: "T. Nagar",
    dealerPhone: "9876543211",
    date: "2026-04-07",
    items: [
      {
        name: "Toned Milk",
        size: "450ml",
        price: 48.89,
        litersPerCrate: 12.6,
        qty: 1,
      },
    ],
    total: 616.01,
    status: "paid",
  },
  {
    id: "b3",
    dealerMongoId: "d4",
    dealerId: "104",
    dealerName: "Ganesh Milk Center",
    dealerCode: "104",
    dealerArea: "Velachery",
    dealerPhone: "9876543213",
    date: "2026-04-06",
    items: [
      {
        name: "Full Cream Milk",
        size: "1L",
        price: 68,
        litersPerCrate: 14,
        qty: 2,
      },
      {
        name: "Set Curd",
        size: "200ml",
        price: 28,
        litersPerCrate: 10,
        qty: 1,
      },
    ],
    total: 2184,
    status: "pending",
  },
];

export const transactions: Transaction[] = [
  { id: "t1", dealerId: "d1", type: "bill", amount: 1087.2, date: "2026-04-07", description: "Bill #b1" },
  { id: "t2", dealerId: "d1", type: "payment", amount: 300, date: "2026-04-06", description: "Cash payment" },
  { id: "t3", dealerId: "d2", type: "bill", amount: 616.01, date: "2026-04-07", description: "Bill #b2" },
  { id: "t4", dealerId: "d2", type: "payment", amount: 700, date: "2026-04-07", description: "UPI payment" },
  { id: "t5", dealerId: "d4", type: "bill", amount: 2184, date: "2026-04-06", description: "Bill #b3" },
  { id: "t6", dealerId: "d4", type: "payment", amount: 500, date: "2026-04-05", description: "Cash payment" },
];
