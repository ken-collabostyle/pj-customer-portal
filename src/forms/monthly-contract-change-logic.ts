// 【クラウド版】注文書兼利用申込書（月額：契約変更）フォーム用の純粋ロジック（DOM・collaboform APIに依存しない部分）。
// kintoneアプリ「クラウド契約管理DB」（アプリID: 73）のレコードを扱う。
// フィールドコードの根拠: docs/kintone/クラウド契約管理DB.md, docs/kintone/json/クラウド契約管理DB_getFormFields.json

export interface KintoneFieldValue {
  value: string;
}

export interface ContractRecord {
  インスタンス: KintoneFieldValue;
  顧客名: KintoneFieldValue;
  区分: KintoneFieldValue;
  月額年額: KintoneFieldValue;
  契約ステータス2: KintoneFieldValue;
  種類２: KintoneFieldValue;
  数量: KintoneFieldValue;
  製品型番: KintoneFieldValue;
  単価_月額_税抜: KintoneFieldValue;
  サービス名_請求書用: KintoneFieldValue;
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
    record.月額年額.value === MONTHLY_BILLING_CYCLE &&
    record.契約ステータス2.value === ACTIVE_CONTRACT_STATUS
  );
}

export function filterActiveMonthlyRecords(records: ContractRecord[]): ContractRecord[] {
  return records.filter(isActiveMonthlyRecord);
}

export function extractUniqueInstances(records: ContractRecord[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const record of records) {
    const instance = record.インスタンス.value;
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
  return records.filter((record) => record.インスタンス.value === instanceName);
}

export function findBaseRecord(records: ContractRecord[]): ContractRecord | undefined {
  return records.find((record) => record.区分.value === BASE_CATEGORY);
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
    corporateName: baseRecord.顧客名.value,
    currentPlan: baseRecord.種類２.value,
    currentUserCount: baseRecord.数量.value,
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
 * 商品名は`サービス名_請求書用`を使用（2026-09-02 ユーザー確認済み。
 * クラウド契約管理DBに「商品名」専用フィールドが存在しないため代替）。
 * 単価は月額契約のみを対象としているため`単価_月額_税抜`固定でよい
 * （年額契約は`isActiveMonthlyRecord`で除外済み）。
 */
export function buildLineItems(records: ContractRecord[]): ContractLineItem[] {
  return records.map((record) => ({
    productName: record.サービス名_請求書用.value,
    productCode: record.製品型番.value,
    unitPrice: record.単価_月額_税抜.value,
    currentQuantity: record.数量.value,
  }));
}
