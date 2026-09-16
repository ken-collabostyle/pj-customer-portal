import { describe, expect, it } from "vitest";
import {
  buildCurrentContractSummary,
  buildLineItems,
  computeEarliestAllowedApplyMonth,
  CONTRACT_DB_FIELD_CODES,
  extractUniqueInstances,
  filterActiveMonthlyRecords,
  filterRecordsByInstance,
  findBaseRecord,
  findUserCountMismatches,
  getBusinessDaysOfMonth,
  getCutoffBusinessDay,
  isActiveMonthlyRecord,
  isApplyMonthSelectionAllowed,
  isBusinessDay,
  toContractRecord,
  type AddedLineItemForValidation,
  type ContractRecord,
  type ExistingLineItemForValidation,
  type RawKintoneRecord,
} from "../../src/forms/monthly-contract-change-logic";

function makeRecord(overrides: Partial<ContractRecord> = {}): ContractRecord {
  return {
    instanceName: "instance-a",
    corporateName: "株式会社サンプル",
    category: "ベース",
    billingCycle: "月額",
    contractStatus2: "契約中",
    planName: "スタンダードプラン",
    quantity: "10",
    productCode: "PROD-001",
    unitPrice: "1000",
    invoiceServiceName: "サンプル商品",
    ...overrides,
  };
}

describe("toContractRecord", () => {
  it("フィールドコード対応表経由でkintone生レコードを内部ドメインモデルへ変換する", () => {
    const raw: RawKintoneRecord = {
      [CONTRACT_DB_FIELD_CODES.instanceName]: { value: "instance-a" },
      [CONTRACT_DB_FIELD_CODES.corporateName]: { value: "株式会社サンプル" },
      [CONTRACT_DB_FIELD_CODES.category]: { value: "ベース" },
      [CONTRACT_DB_FIELD_CODES.billingCycle]: { value: "月額" },
      [CONTRACT_DB_FIELD_CODES.contractStatus2]: { value: "契約中" },
      [CONTRACT_DB_FIELD_CODES.planName]: { value: "スタンダードプラン" },
      [CONTRACT_DB_FIELD_CODES.quantity]: { value: "10" },
      [CONTRACT_DB_FIELD_CODES.productCode]: { value: "PROD-001" },
      [CONTRACT_DB_FIELD_CODES.unitPrice]: { value: "1000" },
      [CONTRACT_DB_FIELD_CODES.invoiceServiceName]: { value: "サンプル商品" },
    };
    expect(toContractRecord(raw)).toEqual(makeRecord());
  });

  it("フィールドが存在しない場合は空文字にフォールバックする", () => {
    expect(toContractRecord({})).toEqual(makeRecord({
      instanceName: "",
      corporateName: "",
      category: "",
      billingCycle: "",
      contractStatus2: "",
      planName: "",
      quantity: "",
      productCode: "",
      unitPrice: "",
      invoiceServiceName: "",
    }));
  });
});

describe("isActiveMonthlyRecord", () => {
  it("月額かつ契約中のレコードはtrue", () => {
    expect(isActiveMonthlyRecord(makeRecord())).toBe(true);
  });

  it("年額のレコードはfalse", () => {
    expect(isActiveMonthlyRecord(makeRecord({ billingCycle: "年額" }))).toBe(false);
  });

  it("契約中以外のステータスはfalse", () => {
    expect(isActiveMonthlyRecord(makeRecord({ contractStatus2: "解約" }))).toBe(false);
  });
});

describe("filterActiveMonthlyRecords", () => {
  it("条件を満たさないレコードを除外する", () => {
    const records = [
      makeRecord({ instanceName: "a" }),
      makeRecord({ instanceName: "b", billingCycle: "年額" }),
      makeRecord({ instanceName: "c", contractStatus2: "解約" }),
    ];
    const result = filterActiveMonthlyRecords(records);
    expect(result.map((r) => r.instanceName)).toEqual(["a"]);
  });
});

describe("extractUniqueInstances", () => {
  it("重複を除いた出現順のインスタンス名一覧を返す", () => {
    const records = [
      makeRecord({ instanceName: "instance-b" }),
      makeRecord({ instanceName: "instance-a" }),
      makeRecord({ instanceName: "instance-b" }),
    ];
    expect(extractUniqueInstances(records)).toEqual(["instance-b", "instance-a"]);
  });

  it("空文字のインスタンス名は無視する", () => {
    const records = [makeRecord({ instanceName: "" }), makeRecord({ instanceName: "instance-a" })];
    expect(extractUniqueInstances(records)).toEqual(["instance-a"]);
  });

  it("レコードが0件なら空配列を返す", () => {
    expect(extractUniqueInstances([])).toEqual([]);
  });
});

describe("filterRecordsByInstance", () => {
  it("指定インスタンスのレコードのみ返す", () => {
    const records = [
      makeRecord({ instanceName: "instance-a", productCode: "P1" }),
      makeRecord({ instanceName: "instance-b", productCode: "P2" }),
    ];
    const result = filterRecordsByInstance(records, "instance-a");
    expect(result.map((r) => r.productCode)).toEqual(["P1"]);
  });
});

describe("findBaseRecord", () => {
  it("区分がベースのレコードを返す", () => {
    const records = [
      makeRecord({ category: "オプション", productCode: "OPT" }),
      makeRecord({ category: "ベース", productCode: "BASE" }),
    ];
    expect(findBaseRecord(records)?.productCode).toBe("BASE");
  });

  it("ベースレコードがなければundefinedを返す", () => {
    const records = [makeRecord({ category: "オプション" })];
    expect(findBaseRecord(records)).toBeUndefined();
  });
});

describe("buildCurrentContractSummary", () => {
  it("ベースレコードから法人名・プラン・ユーザー数を組み立てる", () => {
    const records = [
      makeRecord({ category: "ベース", corporateName: "株式会社テスト", planName: "プレミアム", quantity: "20" }),
      makeRecord({ category: "オプション" }),
    ];
    expect(buildCurrentContractSummary(records)).toEqual({
      corporateName: "株式会社テスト",
      currentPlan: "プレミアム",
      currentUserCount: "20",
    });
  });

  it("ベースレコードがない場合はundefinedを返す", () => {
    expect(buildCurrentContractSummary([makeRecord({ category: "オプション" })])).toBeUndefined();
  });
});

describe("buildLineItems", () => {
  it("各レコードを明細行データへ変換する", () => {
    const records = [
      makeRecord({
        invoiceServiceName: "商品A",
        productCode: "CODE-A",
        unitPrice: "500",
        quantity: "3",
        category: "オプション",
      }),
    ];
    expect(buildLineItems(records)).toEqual([
      {
        productName: "商品A",
        productCode: "CODE-A",
        unitPrice: "500",
        currentQuantity: "3",
        category: "オプション",
      },
    ]);
  });

  it("レコードが0件なら空配列を返す", () => {
    expect(buildLineItems([])).toEqual([]);
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
