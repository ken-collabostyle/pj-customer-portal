// 新規追加商品の検索（商品マスタ）に関する汎用ロジック（DOM・collaboform APIに依存しない部分）。
// 参照: docs/plans/2026-11-19_新規追加商品名のlookupからテキストパーツ+JS検索への置き換え.md

/** 商品マスタ（kintone）のフィールドコード。 */
export const PRODUCT_MASTER_FIELD_CODES = {
  productCode: "文字列__1行_", // メーカー型番
  productName: "商品名_マイページ用",
  unitPrice: "標準単価", // ラベル「標準売価」
  category: "文字列__1行__5", // 商品区分2
  proratedMonths: "数値", // 按分月数（年額のみ使用）
  monthlyOrAnnual: "月額年額",
  onPremiseOrCloud: "ラジオボタン",
  endOfSaleFlag: "販売終了フラグ",
  excludedFromQuote: "見積検索対象外",
} as const;

/** ベースライセンス別の「表示」フラグ（チェックボックス）のフィールドコード。 */
export const PLAN_DISPLAY_FLAG_FIELD_CODES = {
  standard: "スタンダード_表示",
  premium: "プレミアム_表示",
  enterprise: "エンタープライズ_表示",
  academicGovernment: "直販アカガバ_表示",
} as const;

/**
 * 商品区分2（`文字列__1行__5`）がこの値の商品（コラボフォーム・フォームOP）は、
 * ベースライセンス別の「表示」フラグの有無にかかわらず、すべてのベースプランで検索対象にする。
 */
export const FORM_PRODUCT_CATEGORIES = ["フォーム", "フォームOP"] as const;

export const PRODUCT_SEARCH_MAX_ROWS = 20;

/** 商品マスタの「月額／年額」の値。月額版フォームは「月額」、年額版フォームは「年額」で絞り込む。 */
export type ProductBillingCycle = "月額" | "年額";

/**
 * 現在契約プラン名（クラウド契約管理DBの`種類２`）から、絞り込みに使う「表示」フラグのフィールドコードを返す。
 * 実データ例：「スタンダードプラン」「プレミアムプラン アカデミック/ガバメントライセンス」。
 * アカデミック/ガバメントを含む場合は、プランの種類にかかわらずアカガバ用フラグを優先する。
 * どれにも該当しない場合（ライトプラン等）は`undefined`。
 */
export function resolvePlanDisplayFlagField(planName: string): string | undefined {
  const normalized = planName.normalize("NFKC");
  if (normalized.includes("アカデミック") || normalized.includes("ガバメント")) {
    return PLAN_DISPLAY_FLAG_FIELD_CODES.academicGovernment;
  }
  if (normalized.includes("スタンダード")) {
    return PLAN_DISPLAY_FLAG_FIELD_CODES.standard;
  }
  if (normalized.includes("プレミアム")) {
    return PLAN_DISPLAY_FLAG_FIELD_CODES.premium;
  }
  if (normalized.includes("エンタープライズ")) {
    return PLAN_DISPLAY_FLAG_FIELD_CODES.enterprise;
  }
  return undefined;
}

/** kintoneクエリの文字列リテラル用に、バックスラッシュとダブルクォートをエスケープする。 */
export function escapeKintoneQueryString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * 商品マスタ検索のkintoneクエリを組み立てる。固定条件：月額・クラウド・（ベースライセンス対応の表示フラグ=表示 または 商品区分2=フォーム／フォームOP）・
 * 販売終了フラグ=値なし・見積検索対象外=値なし（月額／年額はフォームに応じて指定）。キーワードは空でもよい（「商品名_マイページ用」の部分一致）。
 */
export function buildProductSearchQuery(
  keyword: string,
  planDisplayFlagField: string,
  billingCycle: ProductBillingCycle
): string {
  const f = PRODUCT_MASTER_FIELD_CODES;
  const formCategories = FORM_PRODUCT_CATEGORIES.map((c) => `"${c}"`).join(",");
  const conditions = [
    `${f.monthlyOrAnnual} in ("${billingCycle}")`,
    `${f.onPremiseOrCloud} in ("クラウド")`,
    `(${planDisplayFlagField} in ("表示") or ${f.category} in (${formCategories}))`,
    `${f.endOfSaleFlag} not in ("販売終了")`,
    `${f.excludedFromQuote} not in ("対象外")`,
  ];
  const trimmed = keyword.trim();
  if (trimmed !== "") {
    conditions.push(`${f.productName} like "${escapeKintoneQueryString(trimmed)}"`);
  }
  return `${conditions.join(" and ")} order by ${f.productCode} asc limit ${PRODUCT_SEARCH_MAX_ROWS}`;
}

/** kintone REST APIのレコード（フィールドコード→`{value}`）の最小形状。 */
export type RawProductMasterRecord = Record<string, { value?: unknown } | undefined>;

export interface ProductSearchResultRow {
  productCode: string;
  productName: string;
  unitPrice: string;
  category: string;
  proratedMonths: string;
}

function readText(record: RawProductMasterRecord, code: string): string {
  const value = record[code]?.value;
  return value === undefined || value === null ? "" : String(value);
}

/** kintoneレコードを検索結果行に変換する。 */
export function toProductSearchRows(records: RawProductMasterRecord[]): ProductSearchResultRow[] {
  const f = PRODUCT_MASTER_FIELD_CODES;
  return records.map((record) => ({
    productCode: readText(record, f.productCode),
    productName: readText(record, f.productName),
    unitPrice: readText(record, f.unitPrice),
    category: readText(record, f.category),
    proratedMonths: readText(record, f.proratedMonths),
  }));
}
