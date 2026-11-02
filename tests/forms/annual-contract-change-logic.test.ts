import { describe, expect, it } from "vitest";
import {
  buildCurrentContractSummary,
  buildLineItems,
  computeChangeApplyMonthDiff,
  CONTRACT_DB_FIELD_CODES,
  extractUniqueInstances,
  findProratedMonthsMismatches,
  filterActiveAnnualRecords,
  filterRecordsByInstance,
  findBaseRecord,
  isActiveAnnualRecord,
  parseContractExpiryMonth,
  toContractRecord,
  type ContractRecord,
  type RawKintoneRecord,
} from "../../src/forms/annual-contract-change-logic";

function makeRecord(overrides: Partial<ContractRecord> = {}): ContractRecord {
  return {
    instanceName: "instance-a",
    corporateName: "株式会社サンプル",
    category: "ベース",
    billingCycle: "年額",
    contractStatus2: "契約中",
    planName: "スタンダードプラン",
    quantity: "10",
    productCode: "PROD-001",
    unitPrice: "12000",
    invoiceServiceName: "サンプル商品",
    contractExpiry: "2027-03-31",
    searchId: "",
    ...overrides,
  };
}

describe("toContractRecord", () => {
  it("フィールドコード対応表経由でkintone生レコードを内部ドメインモデルへ変換する", () => {
    const raw: RawKintoneRecord = {
      [CONTRACT_DB_FIELD_CODES.instanceName]: { value: "instance-a" },
      [CONTRACT_DB_FIELD_CODES.corporateName]: { value: "株式会社サンプル" },
      [CONTRACT_DB_FIELD_CODES.category]: { value: "ベース" },
      [CONTRACT_DB_FIELD_CODES.billingCycle]: { value: "年額" },
      [CONTRACT_DB_FIELD_CODES.contractStatus2]: { value: "契約中" },
      [CONTRACT_DB_FIELD_CODES.planName]: { value: "スタンダードプラン" },
      [CONTRACT_DB_FIELD_CODES.quantity]: { value: "10" },
      [CONTRACT_DB_FIELD_CODES.productCode]: { value: "PROD-001" },
      [CONTRACT_DB_FIELD_CODES.unitPrice]: { value: "12000" },
      [CONTRACT_DB_FIELD_CODES.invoiceServiceName]: { value: "サンプル商品" },
      [CONTRACT_DB_FIELD_CODES.contractExpiry]: { value: "2027-03-31" },
      [CONTRACT_DB_FIELD_CODES.searchId]: { value: "" },
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
      contractExpiry: "",
      searchId: "",
    }));
  });
});

describe("isActiveAnnualRecord", () => {
  it("年額かつ契約中のレコードはtrue", () => {
    expect(isActiveAnnualRecord(makeRecord())).toBe(true);
  });

  it("月額のレコードはfalse", () => {
    expect(isActiveAnnualRecord(makeRecord({ billingCycle: "月額" }))).toBe(false);
  });

  it("契約中以外のステータスはfalse", () => {
    expect(isActiveAnnualRecord(makeRecord({ contractStatus2: "解約" }))).toBe(false);
  });
});

describe("filterActiveAnnualRecords", () => {
  it("条件を満たさないレコードを除外する", () => {
    const records = [
      makeRecord({ instanceName: "a" }),
      makeRecord({ instanceName: "b", billingCycle: "月額" }),
      makeRecord({ instanceName: "c", contractStatus2: "解約" }),
    ];
    const result = filterActiveAnnualRecords(records);
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

  it("ベースレコード・テスト環境ライセンスレコードのいずれもなければundefinedを返す", () => {
    const records = [makeRecord({ category: "オプション" })];
    expect(findBaseRecord(records)).toBeUndefined();
  });

  it("ベースレコードがなくても、検索IDがテスト環境ライセンスを示すレコードを代わりに返す", () => {
    const records = [
      makeRecord({
        category: "フォーム",
        productCode: "TEST-ENV",
        searchId: "テスト環境ライセンス  クラウド版",
      }),
    ];
    expect(findBaseRecord(records)?.productCode).toBe("TEST-ENV");
  });

  it("検索IDがテスト環境ライセンスと一致しない場合は対象外", () => {
    const records = [makeRecord({ category: "オプション", searchId: "その他のライセンス" })];
    expect(findBaseRecord(records)).toBeUndefined();
  });

  it("ベースレコードが存在する場合はテスト環境ライセンスレコードより優先する", () => {
    const records = [
      makeRecord({
        category: "フォーム",
        productCode: "TEST-ENV",
        searchId: "テスト環境ライセンス  クラウド版",
      }),
      makeRecord({ category: "ベース", productCode: "BASE" }),
    ];
    expect(findBaseRecord(records)?.productCode).toBe("BASE");
  });
});

describe("buildCurrentContractSummary", () => {
  it("ベースレコードから法人名・プラン・ユーザー数・契約期限を組み立てる", () => {
    const records = [
      makeRecord({
        category: "ベース",
        corporateName: "株式会社テスト",
        planName: "プレミアム",
        quantity: "20",
        contractExpiry: "2028-12-31",
      }),
      makeRecord({ category: "オプション" }),
    ];
    expect(buildCurrentContractSummary(records)).toEqual({
      corporateName: "株式会社テスト",
      currentPlan: "プレミアム",
      currentUserCount: "20",
      contractExpiry: "2028-12-31",
    });
  });

  it("ベースレコードがない場合はundefinedを返す", () => {
    expect(buildCurrentContractSummary([makeRecord({ category: "オプション" })])).toBeUndefined();
  });

  it("テスト環境ライセンス専用インスタンス（ベースレコードなし）でも組み立てる", () => {
    const records = [
      makeRecord({
        category: "フォーム",
        corporateName: "株式会社テスト",
        planName: "テスト環境ライセンス",
        quantity: "1",
        contractExpiry: "",
        searchId: "テスト環境ライセンス  クラウド版",
      }),
    ];
    expect(buildCurrentContractSummary(records)).toEqual({
      corporateName: "株式会社テスト",
      currentPlan: "テスト環境ライセンス",
      currentUserCount: "1",
      contractExpiry: "",
    });
  });
});

describe("buildLineItems", () => {
  it("各レコードを明細行データへ変換する", () => {
    const records = [
      makeRecord({
        invoiceServiceName: "商品A",
        productCode: "CODE-A",
        unitPrice: "5000",
        quantity: "3",
        category: "オプション",
      }),
    ];
    expect(buildLineItems(records)).toEqual([
      {
        productName: "商品A",
        productCode: "CODE-A",
        unitPrice: "5000",
        currentQuantity: "3",
        category: "オプション",
      },
    ]);
  });

  it("レコードが0件なら空配列を返す", () => {
    expect(buildLineItems([])).toEqual([]);
  });
});

describe("parseContractExpiryMonth", () => {
  it("YYYY-MM-DD形式から年・月を取り出す", () => {
    expect(parseContractExpiryMonth("2027-03-31")).toEqual({ year: 2027, month: 3 });
  });

  it("空・形式不正・月が範囲外ならnullを返す", () => {
    expect(parseContractExpiryMonth("")).toBeNull();
    expect(parseContractExpiryMonth("2027/03/31")).toBeNull();
    expect(parseContractExpiryMonth("2027-00-31")).toBeNull();
    expect(parseContractExpiryMonth("2027-13-31")).toBeNull();
  });
});

describe("computeChangeApplyMonthDiff", () => {
  it("適用希望月の翌月から契約期限までの残月数を返す（2026年10月・契約期限2027-03-31 → 5）", () => {
    expect(computeChangeApplyMonthDiff(2026, 10, "2027-03-31")).toBe(5);
  });

  it("年をまたぐ場合も正しく計算する（2026年12月・契約期限2027-03-31 → 3）", () => {
    expect(computeChangeApplyMonthDiff(2026, 12, "2027-03-31")).toBe(3);
  });

  it("同じ年内の場合（2026年10月・契約期限2026-12-31 → 2）", () => {
    expect(computeChangeApplyMonthDiff(2026, 10, "2026-12-31")).toBe(2);
  });

  it("適用希望月が契約期限の月と同じなら0を返す", () => {
    expect(computeChangeApplyMonthDiff(2027, 3, "2027-03-31")).toBe(0);
  });

  it("適用希望月が契約期限の月より後なら負の値をそのまま返す", () => {
    expect(computeChangeApplyMonthDiff(2027, 4, "2027-03-31")).toBe(-1);
  });

  it("12ヶ月の場合（2026年10月・契約期限2027-10-31 → 12）", () => {
    expect(computeChangeApplyMonthDiff(2026, 10, "2027-10-31")).toBe(12);
  });

  it("契約期限が空・形式不正ならnullを返す", () => {
    expect(computeChangeApplyMonthDiff(2026, 10, "")).toBeNull();
    expect(computeChangeApplyMonthDiff(2026, 10, "2027/03/31")).toBeNull();
    expect(computeChangeApplyMonthDiff(2026, 10, "2027-13-31")).toBeNull();
  });

  it("適用希望年月が不正（NaN・非整数・月が範囲外）ならnullを返す", () => {
    expect(computeChangeApplyMonthDiff(Number.NaN, 10, "2027-03-31")).toBeNull();
    expect(computeChangeApplyMonthDiff(2026, Number.NaN, "2027-03-31")).toBeNull();
    expect(computeChangeApplyMonthDiff(2026, 10.5, "2027-03-31")).toBeNull();
    expect(computeChangeApplyMonthDiff(2026, 0, "2027-03-31")).toBeNull();
    expect(computeChangeApplyMonthDiff(2026, 13, "2027-03-31")).toBeNull();
  });
});

describe("findProratedMonthsMismatches", () => {
  function row(proratedMonths: unknown, overrides: { productCode?: string; productName?: string } = {}) {
    return {
      productCode: overrides.productCode ?? "CODE-1",
      productName: overrides.productName ?? "商品A",
      proratedMonths,
    };
  }

  describe("期中（差分1〜11）", () => {
    it("按分月数が差分と一致するnヶ月分商品は不一致なし", () => {
      expect(findProratedMonthsMismatches([row(5)], 5)).toEqual([]);
    });

    it("按分月数が差分と異なるnヶ月分商品は monthsMismatch", () => {
      expect(findProratedMonthsMismatches([row(3)], 5)).toEqual([
        { rowIndex: 1, productName: "商品A", proratedMonths: 3, kind: "monthsMismatch" },
      ]);
    });

    it("フル年額商品（12）は fullYearOnMidTerm", () => {
      expect(findProratedMonthsMismatches([row(12)], 5)).toEqual([
        { rowIndex: 1, productName: "商品A", proratedMonths: 12, kind: "fullYearOnMidTerm" },
      ]);
    });

    it("差分11・1でも同様に判定する", () => {
      expect(findProratedMonthsMismatches([row(11)], 11)).toEqual([]);
      expect(findProratedMonthsMismatches([row(1)], 1)).toEqual([]);
      expect(findProratedMonthsMismatches([row(12)], 11)).toHaveLength(1);
    });
  });

  describe("更新タイミング（差分0）", () => {
    it("フル年額商品（12）は不一致なし", () => {
      expect(findProratedMonthsMismatches([row(12)], 0)).toEqual([]);
    });

    it("nヶ月分商品は partialOnRenewal", () => {
      expect(findProratedMonthsMismatches([row(5)], 0)).toEqual([
        { rowIndex: 1, productName: "商品A", proratedMonths: 5, kind: "partialOnRenewal" },
      ]);
    });
  });

  describe("差分12以上（運用上起こりえないため防御的に差分0と同じ扱い）", () => {
    it("フル年額商品は不一致なし、nヶ月分商品は不一致", () => {
      expect(findProratedMonthsMismatches([row(12)], 12)).toEqual([]);
      expect(findProratedMonthsMismatches([row(12)], 13)).toEqual([]);
      expect(findProratedMonthsMismatches([row(5)], 12)).toHaveLength(1);
    });
  });

  it("差分が負の場合は検証しない", () => {
    expect(findProratedMonthsMismatches([row(5), row(12)], -1)).toEqual([]);
  });

  it("按分月数が空・空白・数値でない・負数・小数・0・範囲外の行はチェック対象外", () => {
    const rows = [row(""), row("  "), row("abc"), row(-1), row(2.5), row(0), row(13), row(null), row(undefined)];
    expect(findProratedMonthsMismatches(rows, 5)).toEqual([]);
  });

  it("商品が選択されていない行（商品コードが空）はチェック対象外", () => {
    expect(findProratedMonthsMismatches([row(3, { productCode: "" }), row(3, { productCode: "  " })], 5)).toEqual([]);
  });

  it("複数行が混在する場合は不一致行のみ（行番号つき）を返す", () => {
    const rows = [
      row(5, { productName: "一致" }),
      row("", { productName: "按分月数なし" }),
      row(3, { productName: "不一致" }),
      row(12, { productName: "フル年額" }),
    ];
    expect(findProratedMonthsMismatches(rows, 5)).toEqual([
      { rowIndex: 3, productName: "不一致", proratedMonths: 3, kind: "monthsMismatch" },
      { rowIndex: 4, productName: "フル年額", proratedMonths: 12, kind: "fullYearOnMidTerm" },
    ]);
  });

  it("値が文字列・数値のどちらで渡されても同じ結果になる", () => {
    expect(findProratedMonthsMismatches([row("5")], 5)).toEqual([]);
    expect(findProratedMonthsMismatches([row(5)], 5)).toEqual([]);
    expect(findProratedMonthsMismatches([row("3")], 5)).toEqual(findProratedMonthsMismatches([row(3)], 5));
  });
});
