const requisitionComponents = [
  { name: "agent", type: "address" },
  { name: "buyer", type: "address" },
  { name: "vendor", type: "address" },
  { name: "amount", type: "uint128" },
  { name: "purposeHash", type: "bytes32" },
  { name: "expiresAt", type: "uint64" },
  { name: "nonce", type: "bytes32" }
] as const;

export const requisitionBookAbi = [
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "r", type: "tuple", components: requisitionComponents },
      { name: "signature", type: "bytes" }
    ],
    outputs: [{ name: "requestId", type: "bytes32" }]
  },
  {
    type: "function",
    name: "payBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "rs", type: "tuple[]", components: requisitionComponents },
      { name: "signatures", type: "bytes[]" }
    ],
    outputs: [{ name: "requestIds", type: "bytes32[]" }]
  },
  {
    type: "function",
    name: "hashRequisition",
    stateMutability: "view",
    inputs: [{ name: "r", type: "tuple", components: requisitionComponents }],
    outputs: [{ name: "requestId", type: "bytes32" }]
  },
  {
    type: "function",
    name: "used",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [{ name: "value", type: "bool" }]
  },
  {
    type: "function",
    name: "records",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [
      { name: "agent", type: "address" },
      { name: "buyer", type: "address" },
      { name: "vendor", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "purposeHash", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "paidAt", type: "uint64" },
      { name: "nonce", type: "bytes32" }
    ]
  },
  {
    type: "function",
    name: "totalPaid",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "value", type: "uint256" }]
  },
  {
    type: "function",
    name: "MAX_BATCH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "value", type: "uint256" }]
  },
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "value", type: "address" }]
  },
  { type: "error", name: "ZeroUsdc", inputs: [] },
  { type: "error", name: "NotBuyer", inputs: [] },
  { type: "error", name: "ZeroAgent", inputs: [] },
  { type: "error", name: "ZeroVendor", inputs: [] },
  { type: "error", name: "VendorIsContract", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "ZeroPurposeHash", inputs: [] },
  { type: "error", name: "Expired", inputs: [] },
  { type: "error", name: "AlreadyUsed", inputs: [{ name: "requestId", type: "bytes32" }] },
  { type: "error", name: "InvalidSignature", inputs: [] },
  { type: "error", name: "EmptyBatch", inputs: [] },
  { type: "error", name: "LengthMismatch", inputs: [] },
  { type: "error", name: "BatchTooLarge", inputs: [] },
  {
    type: "event",
    name: "RequisitionPaid",
    inputs: [
      { name: "requestId", type: "bytes32", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "vendor", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "purposeHash", type: "bytes32", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "nonce", type: "bytes32", indexed: false }
    ]
  }
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "value", type: "uint256" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "value", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "success", type: "bool" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "value", type: "uint8" }]
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "value", type: "string" }]
  }
] as const;
