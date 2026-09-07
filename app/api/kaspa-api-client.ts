import { API_BASE } from "./config";

const DEFAULT_HEADERS = {
  "Cache-Control": "no-cache",
};

export async function getMarketData() {
  // ZKas has no market feed yet: the endpoint returns 204 (empty). Guard against
  // parsing an empty body (which throws "Unexpected end of JSON input") and return a
  // neutral shape so consumers just see no price rather than crashing.
  try {
    const response = await fetch(`${API_BASE}/info/market-data`, { headers: DEFAULT_HEADERS });
    if (!response.ok || response.status === 204) {
      return { current_price: { usd: 0 }, price_change_percentage_24h: 0 };
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { current_price: { usd: 0 }, price_change_percentage_24h: 0 };
  } catch {
    return { current_price: { usd: 0 }, price_change_percentage_24h: 0 };
  }
}

//   const res = await fetch(`${API_BASE}blocks/${hash}?includeColor=true`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getTransaction(hash, blockHash) {
//   const queryParams = blockHash ? `?blockHash=${blockHash}` : "";
//   const res = await fetch(`${API_BASE}transactions/${hash}${queryParams}`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getBlockdagInfo() {
//   const res = await fetch(`${API_BASE}info/blockdag`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getKaspadInfo() {
//   const res = await fetch(`${API_BASE}info/kaspad`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getHashrate() {
//   const res = await fetch(`${API_BASE}info/hashrate`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getHashrateMax() {
//   const res = await fetch(`${API_BASE}info/hashrate/max`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getFeeEstimate() {
//   const res = await fetch(`${API_BASE}info/fee-estimate`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getCoinSupply() {
//   const res = await fetch(`${API_BASE}info/coinsupply`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getAddressBalance(addr) {
//   const res = await fetch(`${API_BASE}addresses/${addr}/balance`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data.balance;
//     });
//   return res;
// }
//
// export async function getAddressTxCount(addr) {
//   const res = await fetch(`${API_BASE}addresses/${addr}/transactions-count`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getAddressUtxos(addr) {
//   const res = await fetch(`${API_BASE}addresses/${addr}/utxos`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getAddressName(addr) {
//   const res = await fetch(`${API_BASE}addresses/${addr}/name`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getHalving() {
//   const res = await fetch(`${API_BASE}info/halving`, {
//     headers: { "Access-Control-Allow-Origin": "*" },
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getTransactionsFromAddress(addr, limit = 20, offset = 0) {
//   const res = await fetch(
//     `${API_BASE}addresses/${addr}/full-transactions?limit=${limit}&offset=${offset}`,
//     {
//       headers: {
//         "Access-Control-Allow-Origin": "*",
//         "content-type": "application/json",
//       },
//       method: "GET",
//     },
//   )
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
//
// export async function getTransactions(tx_list, inputs, outputs) {
//   const res = await fetch(`${API_BASE}transactions/search`, {
//     headers: {
//       "Access-Control-Allow-Origin": "*",
//       "content-type": "application/json",
//     },
//     method: "POST",
//     body: JSON.stringify({ transactionIds: tx_list }),
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       return data;
//     });
//   return res;
// }
