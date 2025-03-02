import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { WalletData, BalanceResult } from "../types";
import * as crypto from "crypto";

// Khóa mã hóa (lấy từ .env, xử lý như hex)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "error"; 
const IV_LENGTH = 16; // Độ dài IV cho AES

// Kiểm tra độ dài và định dạng hex
const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
if (keyBuffer.length !== 32) {
  throw new Error("ENCRYPTION_KEY phải đại diện cho đúng 32 byte (64 ký tự hex) cho AES-256!");
}

// Hàm mã hóa private key
export function encryptPrivateKey(privateKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv); // Dùng buffer từ hex
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// Hàm giải mã private key
export function decryptPrivateKey(encryptedKey: string): string {
  const [ivHex, encrypted] = encryptedKey.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv); // Dùng buffer từ hex
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Tạo ví và trả về private key đã mã hóa
export const generateWallet = (): WalletData => {
  const account = Account.generate();
  const privateKey = account.privateKey.toString();
  return {
    privateKey: encryptPrivateKey(privateKey),
    address: account.accountAddress.toString(),
  };
};

// Lấy thông tin số dư
export async function fetchAccountData(address: any): Promise<BalanceResult> {
  const aptosConfig = new AptosConfig({ network: Network.MAINNET });
  const aptos = new Aptos(aptosConfig);

  try {
    const accountCoinAmount = await aptos.getAccountCoinAmount({
      accountAddress: address,
      coinType: "0x1::aptos_coin::AptosCoin",
    });
    const aptBalance = Number(accountCoinAmount) / 1e8;

    const balances = await aptos.getCurrentFungibleAssetBalances({
      options: {
        where: {
          owner_address: { _eq: address },
          asset_type: {
            _eq: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
          },
        },
      },
    });

    const usdcBalance = balances.length > 0 ? Number(balances[0].amount) / 1e6 : undefined;
    return { aptBalance, usdcBalance };
  } catch (error) {
    console.error("Error fetching account data:", error);
    throw new Error("Không thể lấy thông tin tài khoản. Vui lòng thử lại.");
  }
}