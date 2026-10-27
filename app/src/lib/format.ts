import { formatUnits } from "viem";

export function formatUsdc(value: bigint): string {
  const raw = formatUnits(value, 6);
  const [whole, fraction = ""] = raw.split(".");
  const trimmed = fraction.replace(/0+$/, "").slice(0, 6);
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function formatDateTime(unixSeconds: bigint | number): string {
  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function shortAddress(address: string, size = 4): string {
  if (!address) return "";
  if (address.length <= 2 + size * 2) return address;
  return `${address.slice(0, 2 + size)}...${address.slice(-size)}`;
}

export function humanizeError(error: unknown): string {
  if (!error) return "Unknown error.";
  const record = error as { shortMessage?: string; message?: string };
  const message = record.shortMessage ?? record.message ?? String(error);
  if (/user rejected|user denied|rejected the request/i.test(message)) {
    return "Wallet request was rejected.";
  }
  if (/insufficient allowance|ERC20InsufficientAllowance/i.test(message)) {
    return "USDC allowance is too low. Approve the exact total and retry.";
  }
  if (/insufficient balance|ERC20InsufficientBalance/i.test(message)) {
    return "Buyer USDC balance is too low for this batch.";
  }
  if (/notbuyer|not buyer/i.test(message)) {
    return "This wallet is not the named buyer.";
  }
  if (/alreadyused|already used|alreadypaid|already paid/i.test(message)) {
    return "One of these requests was already paid. Refresh and retry.";
  }
  if (/vendoriscontract|vendor is a contract/i.test(message)) {
    return "The vendor cannot be the RequisitionBook contract.";
  }
  if (/batchtoolarge|batch too large/i.test(message)) {
    return "A batch can hold at most 50 requests.";
  }
  if (/lengthmismatch|batchlengthmismatch|length mismatch/i.test(message)) {
    return "Requests and signatures must have the same length.";
  }
  if (/emptypurpose|zero purpose/i.test(message)) {
    return "A request is missing its purpose hash.";
  }
  if (/zeroamount|zero amount/i.test(message)) {
    return "A request amount is zero.";
  }
  if (/expired/i.test(message)) {
    return "One of these requests has expired.";
  }
  if (/buyermismatch|buyer mismatch/i.test(message)) {
    return "This wallet is not the named buyer.";
  }
  if (/invalidsignature|invalid signature|signature/i.test(message)) {
    return "An agent signature could not be verified.";
  }
  if (/blocked/i.test(message)) {
    return "USDC rejected one of the addresses. No batch funds moved.";
  }
  return message.length > 240 ? `${message.slice(0, 237)}...` : message;
}
