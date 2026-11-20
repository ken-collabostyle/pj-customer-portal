import { describe, expect, it } from "vitest";
import {
  buildProductSearchQuery,
  escapeKintoneQueryString,
  resolvePlanDisplayFlagField,
  splitProductSearchPage,
  toProductSearchRows,
} from "../../src/forms/product-search-logic";

describe("resolvePlanDisplayFlagField", () => {
  it.each([
    ["スタンダードプラン", "スタンダード_表示"],
    ["プレミアムプラン", "プレミアム_表示"],
    ["エンタープライズプラン", "エンタープライズ_表示"],
    ["スタンダードプラン アカデミック/ガバメントライセンス", "直販アカガバ_表示"],
    ["プレミアムプラン アカデミック/ガバメントライセンス", "直販アカガバ_表示"],
    ["エンタープライズプラン アカデミック/ガバメントライセンス", "直販アカガバ_表示"],
  ])("%s → %s", (plan, expected) => {
    expect(resolvePlanDisplayFlagField(plan)).toBe(expected);
  });

  it("該当しないプラン・空文字はundefined", () => {
    expect(resolvePlanDisplayFlagField("ライトプラン")).toBeUndefined();
    expect(resolvePlanDisplayFlagField("")).toBeUndefined();
  });
});

describe("buildProductSearchQuery", () => {
  it("キーワード空でも固定条件のみのクエリを返す", () => {
    expect(buildProductSearchQuery("  ", "スタンダード_表示", "月額")).toBe(
      '月額年額 in ("月額") and ラジオボタン in ("クラウド") ' +
        'and (スタンダード_表示 in ("表示") or 文字列__1行__5 in ("フォーム","フォームOP")) ' +
        'and 販売終了フラグ not in ("販売終了") and 見積検索対象外 not in ("対象外") ' +
        "order by 文字列__1行_ desc limit 21 offset 0"
    );
  });

  it("ページ指定でoffsetが1ページ分ずつ進み、不正なページは1ページ目になる", () => {
    expect(buildProductSearchQuery("", "スタンダード_表示", "月額", 2)).toMatch(/limit 21 offset 20$/);
    expect(buildProductSearchQuery("", "スタンダード_表示", "月額", 3)).toMatch(/limit 21 offset 40$/);
    expect(buildProductSearchQuery("", "スタンダード_表示", "月額", 0)).toMatch(/limit 21 offset 0$/);
  });

  it("キーワードは商品名_マイページ用のlike条件になりエスケープされる", () => {
    const query = buildProductSearchQuery('ab"c', "直販アカガバ_表示", "月額");
    expect(query).toContain('直販アカガバ_表示 in ("表示")');
    expect(query).toContain('文字列__1行__5 in ("フォーム","フォームOP")');
    expect(query).toContain('商品名_マイページ用 like "ab\\"c"');
  });
});

describe("buildProductSearchQuery（年額）", () => {
  it("月額／年額の条件が年額になる", () => {
    const query = buildProductSearchQuery("", "プレミアム_表示", "年額");
    expect(query).toContain('月額年額 in ("年額")');
    expect(query).not.toContain('月額年額 in ("月額")');
  });
});

describe("splitProductSearchPage", () => {
  const makeRows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      productCode: `C${i}`,
      productName: "",
      unitPrice: "",
      category: "",
      proratedMonths: "",
    }));

  it("1ページ分以下なら次ページなし", () => {
    expect(splitProductSearchPage(makeRows(20))).toMatchObject({ hasNext: false });
    expect(splitProductSearchPage(makeRows(20)).rows).toHaveLength(20);
    expect(splitProductSearchPage([])).toEqual({ rows: [], hasNext: false });
  });

  it("21件取得したら先頭20件を表示し、次ページありとする", () => {
    const page = splitProductSearchPage(makeRows(21));
    expect(page.rows).toHaveLength(20);
    expect(page.rows[19].productCode).toBe("C19");
    expect(page.hasNext).toBe(true);
  });
});

describe("escapeKintoneQueryString", () => {
  it("バックスラッシュとダブルクォートをエスケープする", () => {
    expect(escapeKintoneQueryString('a\\b"c')).toBe('a\\\\b\\"c');
  });
});

describe("toProductSearchRows", () => {
  it("レコードを行データに変換し、欠損は空文字にする", () => {
    const rows = toProductSearchRows([
      {
        文字列__1行_: { value: "CC001" },
        商品名_マイページ用: { value: "商品A" },
        標準単価: { value: "1000" },
        文字列__1行__5: { value: "オプション" },
      },
    ]);
    expect(rows).toEqual([
      {
        productCode: "CC001",
        productName: "商品A",
        unitPrice: "1000",
        category: "オプション",
        proratedMonths: "",
      },
    ]);
  });
});
