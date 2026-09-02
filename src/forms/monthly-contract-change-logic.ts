// 【クラウド版】注文書兼利用申込書（月額：契約変更）フォーム用の純粋ロジック（DOM・collaboform APIに依存しない部分）。
// kintoneアプリ「クラウド契約管理DB」（アプリID: 73）のレコードを扱う。
// フィールドコードの根拠: docs/kintone/クラウド契約管理DB.md, docs/kintone/json/クラウド契約管理DB_getFormFields.json

export interface KintoneFieldValue {
  value: string;
}

/** kintoneから返る生レコード。キーはフィールドコード（kintone側の設定で変更されうる）。 */
export type RawKintoneRecord = Record<string, KintoneFieldValue>;

/**
 * kintone「クラウド契約管理DB」のフィールドコード対応表。
 * kintone側でフィールドコードが変更された場合は、このオブジェクトのみを修正すればよい
 * （以降のロジック・テストは`ContractRecord`の安定したプロパティ名のみを参照するため無修正で済む）。
 */
export const CONTRACT_DB_FIELD_CODES = {
  instanceName: "インスタンス",
  corporateName: "顧客名",
  category: "区分",
  billingCycle: "月額年額",
  contractStatus2: "契約ステータス2",
  planName: "種類２",
  quantity: "数量",
  productCode: "製品型番",
  unitPrice: "単価_月額_税抜",
  invoiceServiceName: "サービス名_請求書用",
} as const;

/** プログラム内部で使う、kintoneのフィールドコード変更に影響されない安定したドメインモデル。 */
export interface ContractRecord {
  instanceName: string;
  corporateName: string;
  category: string;
  billingCycle: string;
  contractStatus2: string;
  planName: string;
  quantity: string;
  productCode: string;
  unitPrice: string;
  invoiceServiceName: string;
}

/** kintoneの生レコードを、フィールドコード対応表経由で内部ドメインモデルへ変換する。 */
export function toContractRecord(raw: RawKintoneRecord): ContractRecord {
  const getValue = (fieldCode: string): string => raw[fieldCode]?.value ?? "";
  return {
    instanceName: getValue(CONTRACT_DB_FIELD_CODES.instanceName),
    corporateName: getValue(CONTRACT_DB_FIELD_CODES.corporateName),
    category: getValue(CONTRACT_DB_FIELD_CODES.category),
    billingCycle: getValue(CONTRACT_DB_FIELD_CODES.billingCycle),
    contractStatus2: getValue(CONTRACT_DB_FIELD_CODES.contractStatus2),
    planName: getValue(CONTRACT_DB_FIELD_CODES.planName),
    quantity: getValue(CONTRACT_DB_FIELD_CODES.quantity),
    productCode: getValue(CONTRACT_DB_FIELD_CODES.productCode),
    unitPrice: getValue(CONTRACT_DB_FIELD_CODES.unitPrice),
    invoiceServiceName: getValue(CONTRACT_DB_FIELD_CODES.invoiceServiceName),
  };
}

const BASE_CATEGORY = "ベース";
const MONTHLY_BILLING_CYCLE = "月額";
const ACTIVE_CONTRACT_STATUS = "契約中";

/**
 * 「現在有効な月額契約」のレコードか判定する。
 * 2026-09-02 ユーザー確認済み：区分=ベース かつ 月額年額=月額 かつ 契約ステータス2=契約中 を
 * 「現在契約中のレコード」の条件とする。
 */
export function isActiveMonthlyRecord(record: ContractRecord): boolean {
  return (
    record.billingCycle === MONTHLY_BILLING_CYCLE &&
    record.contractStatus2 === ACTIVE_CONTRACT_STATUS
  );
}

export function filterActiveMonthlyRecords(records: ContractRecord[]): ContractRecord[] {
  return records.filter(isActiveMonthlyRecord);
}

export function extractUniqueInstances(records: ContractRecord[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const record of records) {
    const instance = record.instanceName;
    if (instance !== "" && !seen.has(instance)) {
      seen.add(instance);
      result.push(instance);
    }
  }
  return result;
}

export function filterRecordsByInstance(
  records: ContractRecord[],
  instanceName: string
): ContractRecord[] {
  return records.filter((record) => record.instanceName === instanceName);
}

export function findBaseRecord(records: ContractRecord[]): ContractRecord | undefined {
  return records.find((record) => record.category === BASE_CATEGORY);
}

export interface CurrentContractSummary {
  corporateName: string;
  currentPlan: string;
  currentUserCount: string;
}

export function buildCurrentContractSummary(
  records: ContractRecord[]
): CurrentContractSummary | undefined {
  const baseRecord = findBaseRecord(records);
  if (!baseRecord) {
    return undefined;
  }
  return {
    corporateName: baseRecord.corporateName,
    currentPlan: baseRecord.planName,
    currentUserCount: baseRecord.quantity,
  };
}

export interface ContractLineItem {
  productName: string;
  productCode: string;
  unitPrice: string;
  currentQuantity: string;
}

/**
 * 明細テーブルの1行に相当するデータへ変換する。
 * 商品名は`invoiceServiceName`（kintoneの`サービス名_請求書用`）を使用（2026-09-02 ユーザー確認済み。
 * クラウド契約管理DBに「商品名」専用フィールドが存在しないため代替）。
 * 単価は月額契約のみを対象としているため`unitPrice`固定でよい
 * （年額契約は`isActiveMonthlyRecord`で除外済み）。
 */
export function buildLineItems(records: ContractRecord[]): ContractLineItem[] {
  return records.map((record) => ({
    productName: record.invoiceServiceName,
    productCode: record.productCode,
    unitPrice: record.unitPrice,
    currentQuantity: record.quantity,
  }));
}
