// 【クラウド版】注文書兼利用申込書（年額：契約変更）フォーム用の純粋ロジック（DOM・collaboform APIに依存しない部分）。
// kintoneアプリ「クラウド契約管理DB」（アプリID: 73）のレコードを扱う。
// フィールドコードの根拠: docs/kintone/クラウド契約管理DB.md, docs/kintone/json/クラウド契約管理DB_getFormFields.json
// 月額・年額で共通の汎用ロジック（営業日計算・オプションユーザー数整合性チェック）は
// contract-change-shared-logic.ts参照。kintoneレコード変換・明細行構築は月額・年額で
// 分岐する可能性があるため、フォームごとに複製する方針
// （docs/plans/2026-09-25_フェーズ4_年額契約変更カスタマイズ計画.md「アーキテクチャ方針」参照）。

import { findBaseOrTestEnvLicenseRecord } from "./contract-change-shared-logic";

export interface KintoneFieldValue {
  value: string;
}

/** kintoneから返る生レコード。キーはフィールドコード（kintone側の設定で変更されうる）。 */
export type RawKintoneRecord = Record<string, KintoneFieldValue>;

/**
 * kintone「クラウド契約管理DB」のフィールドコード対応表（年額版）。
 * kintone側でフィールドコードが変更された場合は、このオブジェクトのみを修正すればよい
 * （以降のロジック・テストは`ContractRecord`の安定したプロパティ名のみを参照するため無修正で済む）。
 * `unitPrice`・`contractExpiry`は月額版と異なる（docs/kintone/クラウド契約管理DB.md参照）。
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
  // 2026-08-25ユーザー確認済み：`月額年額`が「年額」の場合の単価は`契約金額`を使う
  // （フィールドのラベル表記と実際の用途が一致していない点に注意）。
  unitPrice: "契約金額",
  invoiceServiceName: "サービス名_請求書用",
  // 年額のみ新規（DATE型）。
  contractExpiry: "契約終了日",
  // テスト環境ライセンス専用インスタンスの判定用（2026-10-02追加）。
  searchId: "検索ID",
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
  contractExpiry: string;
  searchId: string;
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
    contractExpiry: getValue(CONTRACT_DB_FIELD_CODES.contractExpiry),
    searchId: getValue(CONTRACT_DB_FIELD_CODES.searchId),
  };
}

const ANNUAL_BILLING_CYCLE = "年額";
const ACTIVE_CONTRACT_STATUS = "契約中";

/**
 * 「現在有効な年額契約」のレコードか判定する。
 * 月額版の`isActiveMonthlyRecord`と同じ考え方（2026-09-02ユーザー確認済みの条件を年額に適用）：
 * 月額年額=年額 かつ 契約ステータス2=契約中 を「現在契約中のレコード」の条件とする。
 */
export function isActiveAnnualRecord(record: ContractRecord): boolean {
  return (
    record.billingCycle === ANNUAL_BILLING_CYCLE &&
    record.contractStatus2 === ACTIVE_CONTRACT_STATUS
  );
}

export function filterActiveAnnualRecords(records: ContractRecord[]): ContractRecord[] {
  return records.filter(isActiveAnnualRecord);
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

/**
 * 区分=ベースのレコードを探す。見つからない場合、テスト環境ライセンス専用インスタンス
 * （契約品目がテスト環境ライセンスの1行のみで区分=ベースの行が存在しないケース）向けに、
 * `検索ID`がテスト環境ライセンスを示すレコードを代わりに返す（2026-10-02ユーザー確認）。
 */
export function findBaseRecord(records: ContractRecord[]): ContractRecord | undefined {
  return findBaseOrTestEnvLicenseRecord(records);
}

export interface CurrentContractSummary {
  corporateName: string;
  currentPlan: string;
  currentUserCount: string;
  contractExpiry: string;
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
    contractExpiry: baseRecord.contractExpiry,
  };
}

export interface ContractLineItem {
  productName: string;
  productCode: string;
  unitPrice: string;
  currentQuantity: string;
  category: string;
}

/**
 * 明細テーブルの1行に相当するデータへ変換する。
 * 商品名は`invoiceServiceName`（kintoneの`サービス名_請求書用`）を使用（月額版と同様）。
 * **「nヶ月分」商品の年間商品への読み替えは行わない**（フェーズ2、商品マスタ連携のブロッカー
 * 未解消のため対象外。取得した商品コード・商品名をそのまま表示する。
 * docs/plans/2026-09-25_フェーズ4_年額契約変更カスタマイズ計画.md フェーズ2参照）。
 * `category`（区分）はステップc（オプションのユーザー数整合性チェック）で使用する。
 */
export function buildLineItems(records: ContractRecord[]): ContractLineItem[] {
  return records.map((record) => ({
    productName: record.invoiceServiceName,
    productCode: record.productCode,
    unitPrice: record.unitPrice,
    currentQuantity: record.quantity,
    category: record.category,
  }));
}

/**
 * 契約期限（kintoneの`契約終了日`、`YYYY-MM-DD`形式）から年・月を取り出す。
 * 形式不正・空・月が1〜12の範囲外なら`null`を返す。
 */
export function parseContractExpiryMonth(
  contractExpiry: string
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(contractExpiry);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

/**
 * 変更適用月差分（`fidChangeApplyMonthDiff`）を算出する。
 * 変更適用希望月の翌月から契約期限までの残月数
 * （＝`（契約期限の年×12＋月）－（変更適用希望年×12＋月）`、2026-10-26業務支援チームMTGで確定）。
 * 契約期限は運用上必ず月末のため、日は使わず年月のみで計算する。
 * 例：適用希望2026年10月・契約期限2027-03-31 → 課金対象は11〜3月の5ヶ月＝5。
 * 契約期限が`YYYY-MM-DD`形式でない、または適用希望年月が不正（非整数・月が1〜12の範囲外）なら
 * `null`を返す。0以下の値も補正せずそのまま返す（申請可否は呼び出し側で判定する）。
 */
export function computeChangeApplyMonthDiff(
  applyYear: number,
  applyMonth: number,
  contractExpiry: string
): number | null {
  if (!Number.isInteger(applyYear) || !Number.isInteger(applyMonth)) {
    return null;
  }
  if (applyMonth < 1 || applyMonth > 12) {
    return null;
  }

  const expiry = parseContractExpiryMonth(contractExpiry);
  if (!expiry) {
    return null;
  }

  return expiry.year * 12 + expiry.month - (applyYear * 12 + applyMonth);
}
