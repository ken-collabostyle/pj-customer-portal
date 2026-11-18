import {
  describe,
  expect,
  it } from "vitest";
import {
  computeEarliestAllowedApplyMonth,
  findBaseOrTestEnvLicenseRecord,
  findUserCountMismatches,
  getBusinessDaysOfMonth,
  getCutoffBusinessDay,
  isApplyMonthSelectionAllowed,
  isBusinessDay,
  TEST_ENV_CATEGORY,
  type AddedLineItemForValidation,
  type ExistingLineItemForValidation,
  type RecordWithCategory,
  findEmptyTestEnvUrlFields,
  findInvalidAddedQuantities,
  hasTestEnvLicenseProduct,
  toNumberOrNaN,
} from "../../src/forms/contract-change-shared-logic";

// テスト環境ライセンス専用インスタンスの「ベース」代替判定（2026-10-02追加。2026-11-18に検索IDから区分ベースへ変更）

function makeCategoryRecord(overrides: Partial<RecordWithCategory> = {}): RecordWithCategory {
  return { category: "オプション", ...overrides };
}

describe("findBaseOrTestEnvLicenseRecord", () => {
  it("区分がベースのレコードを優先して返す", () => {
    const records = [
      makeCategoryRecord({ category: "オプション" }),
      makeCategoryRecord({ category: "ベース" }),
    ];
    expect(findBaseOrTestEnvLicenseRecord(records)).toBe(records[1]);
  });

  it("ベースレコードがなければ区分がテスト環境のレコードを返す", () => {
    const records = [
      makeCategoryRecord({ category: "フォーム" }),
      makeCategoryRecord({ category: TEST_ENV_CATEGORY }),
    ];
    expect(findBaseOrTestEnvLicenseRecord(records)).toBe(records[1]);
  });

  it("ベースレコードがあれば、区分がテスト環境のレコードより優先する（順序によらない）", () => {
    const records = [
      makeCategoryRecord({ category: TEST_ENV_CATEGORY }),
      makeCategoryRecord({ category: "ベース" }),
    ];
    expect(findBaseOrTestEnvLicenseRecord(records)).toBe(records[1]);
  });

  it("ベース・テスト環境のいずれもなければundefinedを返す", () => {
    const records = [makeCategoryRecord({ category: "オプション" })];
    expect(findBaseOrTestEnvLicenseRecord(records)).toBeUndefined();
  });

  it("区分の表記が完全一致しない場合（半角・空白入り）はテスト環境とみなさない", () => {
    const records = [
      makeCategoryRecord({ category: "テスト環境 " }),
      makeCategoryRecord({ category: "ﾃｽﾄ環境" }),
    ];
    expect(findBaseOrTestEnvLicenseRecord(records)).toBeUndefined();
  });

  it("レコードが0件ならundefinedを返す", () => {
    expect(findBaseOrTestEnvLicenseRecord([])).toBeUndefined();
  });
});

// 全般バリデーション：オプションのユーザー数整合性（フェーズ1ステップe）

function makeExistingRow(
  overrides: Partial<ExistingLineItemForValidation> = {}
): ExistingLineItemForValidation {
  return { category: "ベース", changedQuantity: "10", isCancelled: false, ...overrides };
}

function makeAddedRow(overrides: Partial<AddedLineItemForValidation> = {}): AddedLineItemForValidation {
  return { category: "", quantity: "", ...overrides };
}

describe("findUserCountMismatches", () => {
  it("ベースとオプションの数量が一致する場合は不一致なし", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "10" }),
      makeExistingRow({ category: "オプション", changedQuantity: "10" }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toEqual([]);
  });

  it("既存オプション行の数量がベースと異なる場合は不一致として検出する", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "10" }),
      makeExistingRow({ category: "オプション", changedQuantity: "5" }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toEqual([
      { source: "existing", rowIndex: 2, category: "オプション", quantity: "5" },
    ]);
  });

  it("対象『区分』（オプション系すべて）はいずれも不一致検出の対象になる", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "10" }),
      makeExistingRow({ category: "オプション（ライセンスキー不要）", changedQuantity: "5" }),
      makeExistingRow({ category: "オプション（転記不要）", changedQuantity: "5" }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toHaveLength(2);
  });

  it("『フォーム』『フォームOP』区分は対象外", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "10" }),
      makeExistingRow({ category: "フォーム", changedQuantity: "1" }),
      makeExistingRow({ category: "フォームOP", changedQuantity: "1" }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toEqual([]);
  });

  it("解約チェックONの既存オプション行は不一致判定の対象外", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "10" }),
      makeExistingRow({ category: "オプション", changedQuantity: "0", isCancelled: true }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toEqual([]);
  });

  it("ベース行が解約済みの場合はチェック自体をスキップする", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "0", isCancelled: true }),
      makeExistingRow({ category: "オプション", changedQuantity: "5" }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toEqual([]);
  });

  it("ベース行が存在しない場合はチェック自体をスキップする", () => {
    const existingRows = [makeExistingRow({ category: "オプション", changedQuantity: "5" })];
    expect(findUserCountMismatches(existingRows, [])).toEqual([]);
  });

  it("新規追加行の数量がベースと異なる場合は不一致として検出する", () => {
    const existingRows = [makeExistingRow({ category: "ベース", changedQuantity: "10" })];
    const addedRows = [makeAddedRow({ category: "オプション", quantity: "3" })];
    expect(findUserCountMismatches(existingRows, addedRows)).toEqual([
      { source: "added", rowIndex: 1, category: "オプション", quantity: "3" },
    ]);
  });

  it("新規追加行の数量がベースと一致する場合は不一致なし", () => {
    const existingRows = [makeExistingRow({ category: "ベース", changedQuantity: "10" })];
    const addedRows = [makeAddedRow({ category: "オプション", quantity: "10" })];
    expect(findUserCountMismatches(existingRows, addedRows)).toEqual([]);
  });

  it("区分が空（未使用行）の新規追加行は対象外", () => {
    const existingRows = [makeExistingRow({ category: "ベース", changedQuantity: "10" })];
    const addedRows = [makeAddedRow({ category: "", quantity: "" })];
    expect(findUserCountMismatches(existingRows, addedRows)).toEqual([]);
  });

  it("区分が『ベース』の新規追加行は想定外入力として対象外", () => {
    const existingRows = [makeExistingRow({ category: "ベース", changedQuantity: "10" })];
    const addedRows = [makeAddedRow({ category: "ベース", quantity: "999" })];
    expect(findUserCountMismatches(existingRows, addedRows)).toEqual([]);
  });

  // 2026-11-18：テスト環境ライセンスの区分が「オプション」から「テスト環境」に変わったため、
  // ベースと数量が異なっても不一致として検出しない（ユーザー確認済み：対象外）。
  it("区分が『テスト環境』の既存行は、ベースと数量が異なっても対象外", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "10" }),
      makeExistingRow({ category: TEST_ENV_CATEGORY, changedQuantity: "1" }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toEqual([]);
  });

  it("区分が『テスト環境』の新規追加行は、ベースと数量が異なっても対象外", () => {
    const existingRows = [makeExistingRow({ category: "ベース", changedQuantity: "10" })];
    const addedRows = [makeAddedRow({ category: TEST_ENV_CATEGORY, quantity: "1" })];
    expect(findUserCountMismatches(existingRows, addedRows)).toEqual([]);
  });

  it("『テスト環境』行が混在しても、通常のオプション行の不一致は検出する", () => {
    const existingRows = [
      makeExistingRow({ category: "ベース", changedQuantity: "10" }),
      makeExistingRow({ category: TEST_ENV_CATEGORY, changedQuantity: "1" }),
      makeExistingRow({ category: "オプション", changedQuantity: "5" }),
    ];
    expect(findUserCountMismatches(existingRows, [])).toEqual([
      { source: "existing", rowIndex: 3, category: "オプション", quantity: "5" },
    ]);
  });
});

// 以下、変更適用希望年月（フェーズ1ステップf）のテスト。祝日データは実データ（japan-holidays.ts）に
// 依存せず、テストごとに用意した最小限のSetを使う。2024年1月は元日(1/1,月)を祝日として扱うケースの
// フィクスチャとして使用（1/1のみ祝日、他は土日判定のみ）。

describe("isBusinessDay", () => {
  const holidays = new Set(["2024-01-01"]);

  it("平日かつ祝日でなければtrue", () => {
    expect(isBusinessDay(new Date(2024, 0, 2), holidays)).toBe(true); // 1/2(火)
  });

  it("土曜はfalse", () => {
    expect(isBusinessDay(new Date(2024, 0, 6), holidays)).toBe(false); // 1/6(土)
  });

  it("日曜はfalse", () => {
    expect(isBusinessDay(new Date(2024, 0, 7), holidays)).toBe(false); // 1/7(日)
  });

  it("祝日（平日）はfalse", () => {
    expect(isBusinessDay(new Date(2024, 0, 1), holidays)).toBe(false); // 1/1(月・祝)
  });
});

describe("getBusinessDaysOfMonth", () => {
  it("土日・祝日を除いた営業日一覧を返す", () => {
    const holidays = new Set(["2024-01-01"]);
    const businessDays = getBusinessDaysOfMonth(2024, 1, holidays);
    expect(businessDays).toHaveLength(22);
    expect(businessDays[0].getDate()).toBe(2);
    expect(businessDays[businessDays.length - 1].getDate()).toBe(31);
  });
});

describe("getCutoffBusinessDay", () => {
  it("最終営業日から数えて3番目の営業日を返す", () => {
    const holidays = new Set(["2024-01-01"]);
    const cutoff = getCutoffBusinessDay(2024, 1, holidays);
    expect(cutoff?.getDate()).toBe(29); // 1/29(月)。1/31(水)を1番目として3番目
  });
});

describe("computeEarliestAllowedApplyMonth", () => {
  const holidays = new Set(["2024-01-01"]);

  it("当月選択可能期限日より前なら当月を返す", () => {
    expect(computeEarliestAllowedApplyMonth(new Date(2024, 0, 26), holidays)).toEqual({
      year: 2024,
      month: 1,
    });
  });

  it("当月選択可能期限日当日は翌月を返す（当日を含む）", () => {
    expect(computeEarliestAllowedApplyMonth(new Date(2024, 0, 29), holidays)).toEqual({
      year: 2024,
      month: 2,
    });
  });

  it("当月選択可能期限日より後（月末）も翌月を返す", () => {
    expect(computeEarliestAllowedApplyMonth(new Date(2024, 0, 31), holidays)).toEqual({
      year: 2024,
      month: 2,
    });
  });

  it("12月の当月選択可能期限日以降は翌年1月を返す（年またぎ）", () => {
    expect(computeEarliestAllowedApplyMonth(new Date(2024, 11, 27), new Set())).toEqual({
      year: 2025,
      month: 1,
    });
  });
});

describe("isApplyMonthSelectionAllowed", () => {
  const today = new Date(2024, 0, 26); // 当月選択可能期限日より前 → 最早選択可能年月は2024年1月
  const holidays = new Set(["2024-01-01"]);

  it("最早選択可能年月と同じならtrue", () => {
    expect(isApplyMonthSelectionAllowed(2024, 1, today, holidays)).toBe(true);
  });

  it("最早選択可能年月より後（同年の翌月）ならtrue", () => {
    expect(isApplyMonthSelectionAllowed(2024, 2, today, holidays)).toBe(true);
  });

  it("最早選択可能年月より前（同年の前月）ならfalse", () => {
    expect(isApplyMonthSelectionAllowed(2023, 12, today, holidays)).toBe(false);
  });

  it("年が後なら月に関わらずtrue", () => {
    expect(isApplyMonthSelectionAllowed(2025, 1, today, holidays)).toBe(true);
  });

  it("年が前なら月に関わらずfalse", () => {
    expect(isApplyMonthSelectionAllowed(2023, 12, today, holidays)).toBe(false);
  });
});

describe("findInvalidAddedQuantities", () => {
  function row(quantity: unknown, overrides: { productCode?: unknown; productName?: unknown } = {}) {
    return {
      productCode: "productCode" in overrides ? overrides.productCode : "CODE-1",
      productName: "productName" in overrides ? overrides.productName : "商品A",
      quantity,
    };
  }

  it("数量が1以上の整数なら対象外", () => {
    expect(findInvalidAddedQuantities([row(1), row("5"), row(100)])).toEqual([]);
  });

  it("未入力・空白・null・undefined・0・負数・小数・数値でない場合は不正として返す", () => {
    const rows = [row(""), row("  "), row(null), row(undefined), row(0), row("0"), row(-1), row(2.5), row("abc")];
    const result = findInvalidAddedQuantities(rows);
    expect(result.map((r) => r.rowIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result[0]).toEqual({ rowIndex: 1, productName: "商品A" });
  });

  it("商品コードのみ・商品名のみが入力された行も対象になる", () => {
    expect(findInvalidAddedQuantities([row("", { productName: "" })])).toHaveLength(1);
    expect(findInvalidAddedQuantities([row("", { productCode: "" })])).toHaveLength(1);
  });

  it("商品が未選択（コード・名前とも空）の行は数量が不正でも対象外", () => {
    expect(
      findInvalidAddedQuantities([
        row("", { productCode: "", productName: "" }),
        row(0, { productCode: "  ", productName: null }),
        row("", { productCode: undefined, productName: undefined }),
      ])
    ).toEqual([]);
  });

  it("複数行のうち不正な行のみ（行番号つき）を返す", () => {
    const rows = [row(1, { productName: "正常" }), row("", { productName: "数量なし" }), row(3)];
    expect(findInvalidAddedQuantities(rows)).toEqual([{ rowIndex: 2, productName: "数量なし" }]);
  });

  it("値が文字列・数値のどちらで渡されても同じ結果になる", () => {
    expect(findInvalidAddedQuantities([row("3")])).toEqual(findInvalidAddedQuantities([row(3)]));
    expect(findInvalidAddedQuantities([row("0")])).toEqual(findInvalidAddedQuantities([row(0)]));
  });
});

// 2026-11-18：判別を商品コード（CCTLST0000）から、新規追加行の区分（「テスト環境」）へ変更
describe("hasTestEnvLicenseProduct", () => {
  it("区分が『テスト環境』ならtrue", () => {
    expect(hasTestEnvLicenseProduct(["テスト環境"])).toBe(true);
  });

  it("『テスト環境』以外の区分（オプション・ベース等）はfalse", () => {
    expect(hasTestEnvLicenseProduct(["オプション", "ベース", "フォーム"])).toBe(false);
  });

  it("完全一致しない表記（前後の空白・半角・部分一致）はfalse", () => {
    expect(hasTestEnvLicenseProduct([" テスト環境", "テスト環境 ", "ﾃｽﾄ環境", "テスト環境ライセンス"])).toBe(
      false
    );
  });

  it("商品コードに由来する文字列（CCTLST0000）は判別に使わない", () => {
    expect(hasTestEnvLicenseProduct(["CCTLST0000"])).toBe(false);
  });

  it("空・null・undefined・空配列はfalse", () => {
    expect(hasTestEnvLicenseProduct(["", null, undefined])).toBe(false);
    expect(hasTestEnvLicenseProduct([])).toBe(false);
  });

  it("複数行のうち1行のみ該当してもtrue", () => {
    expect(hasTestEnvLicenseProduct(["オプション", "", "テスト環境", "オプション"])).toBe(true);
  });
});

describe("findEmptyTestEnvUrlFields", () => {
  it("3つとも入力済みなら空配列", () => {
    expect(findEmptyTestEnvUrlFields({ firstChoice: "a", secondChoice: "b", thirdChoice: "c" })).toEqual([]);
  });

  it("一部未入力なら該当項目の表示名のみ返す", () => {
    expect(findEmptyTestEnvUrlFields({ firstChoice: "a", secondChoice: "", thirdChoice: "c" })).toEqual([
      "テスト環境のURL希望②",
    ]);
  });

  it("全て未入力なら3項目を返す", () => {
    expect(findEmptyTestEnvUrlFields({ firstChoice: "", secondChoice: "", thirdChoice: "" })).toEqual([
      "テスト環境のURL希望①",
      "テスト環境のURL希望②",
      "テスト環境のURL希望③",
    ]);
  });

  it("空白のみ・null・undefinedは未入力扱い", () => {
    expect(
      findEmptyTestEnvUrlFields({ firstChoice: "  ", secondChoice: null, thirdChoice: undefined })
    ).toHaveLength(3);
  });
});

describe("toNumberOrNaN", () => {
  it("数値・数値文字列は数値に変換する", () => {
    expect(toNumberOrNaN(5)).toBe(5);
    expect(toNumberOrNaN("2026")).toBe(2026);
    expect(toNumberOrNaN(" 10 ")).toBe(10);
    expect(toNumberOrNaN("0")).toBe(0);
  });

  it("空文字・空白のみ・null・undefinedはNaN（0にしない）", () => {
    expect(toNumberOrNaN("")).toBeNaN();
    expect(toNumberOrNaN("   ")).toBeNaN();
    expect(toNumberOrNaN(null)).toBeNaN();
    expect(toNumberOrNaN(undefined)).toBeNaN();
  });

  it("数値として解釈できない値はNaN", () => {
    expect(toNumberOrNaN("abc")).toBeNaN();
  });
});
