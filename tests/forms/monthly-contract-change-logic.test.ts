import { describe, expect, it } from "vitest";
import {
  buildCurrentContractSummary,
  buildLineItems,
  extractUniqueInstances,
  filterActiveMonthlyRecords,
  filterRecordsByInstance,
  findBaseRecord,
  isActiveMonthlyRecord,
  type ContractRecord,
} from "../../src/forms/monthly-contract-change-logic";

function makeRecord(overrides: Partial<Record<keyof ContractRecord, string>>): ContractRecord {
  const defaults: Record<keyof ContractRecord, string> = {
    インスタンス: "instance-a",
    顧客名: "株式会社サンプル",
    区分: "ベース",
    月額年額: "月額",
    契約ステータス2: "契約中",
    種類２: "スタンダードプラン",
    数量: "10",
    製品型番: "PROD-001",
    単価_月額_税抜: "1000",
    サービス名_請求書用: "サンプル商品",
  };
  const merged = { ...defaults, ...overrides };
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, { value }])
  ) as unknown as ContractRecord;
}

describe("isActiveMonthlyRecord", () => {
  it("月額かつ契約中のレコードはtrue", () => {
    expect(isActiveMonthlyRecord(makeRecord({}))).toBe(true);
  });

  it("年額のレコードはfalse", () => {
    expect(isActiveMonthlyRecord(makeRecord({ 月額年額: "年額" }))).toBe(false);
  });

  it("契約中以外のステータスはfalse", () => {
    expect(isActiveMonthlyRecord(makeRecord({ 契約ステータス2: "解約" }))).toBe(false);
  });
});

describe("filterActiveMonthlyRecords", () => {
  it("条件を満たさないレコードを除外する", () => {
    const records = [
      makeRecord({ インスタンス: "a" }),
      makeRecord({ インスタンス: "b", 月額年額: "年額" }),
      makeRecord({ インスタンス: "c", 契約ステータス2: "解約" }),
    ];
    const result = filterActiveMonthlyRecords(records);
    expect(result.map((r) => r.インスタンス.value)).toEqual(["a"]);
  });
});

describe("extractUniqueInstances", () => {
  it("重複を除いた出現順のインスタンス名一覧を返す", () => {
    const records = [
      makeRecord({ インスタンス: "instance-b" }),
      makeRecord({ インスタンス: "instance-a" }),
      makeRecord({ インスタンス: "instance-b" }),
    ];
    expect(extractUniqueInstances(records)).toEqual(["instance-b", "instance-a"]);
  });

  it("空文字のインスタンス名は無視する", () => {
    const records = [makeRecord({ インスタンス: "" }), makeRecord({ インスタンス: "instance-a" })];
    expect(extractUniqueInstances(records)).toEqual(["instance-a"]);
  });

  it("レコードが0件なら空配列を返す", () => {
    expect(extractUniqueInstances([])).toEqual([]);
  });
});

describe("filterRecordsByInstance", () => {
  it("指定インスタンスのレコードのみ返す", () => {
    const records = [
      makeRecord({ インスタンス: "instance-a", 製品型番: "P1" }),
      makeRecord({ インスタンス: "instance-b", 製品型番: "P2" }),
    ];
    const result = filterRecordsByInstance(records, "instance-a");
    expect(result.map((r) => r.製品型番.value)).toEqual(["P1"]);
  });
});

describe("findBaseRecord", () => {
  it("区分がベースのレコードを返す", () => {
    const records = [
      makeRecord({ 区分: "オプション", 製品型番: "OPT" }),
      makeRecord({ 区分: "ベース", 製品型番: "BASE" }),
    ];
    expect(findBaseRecord(records)?.製品型番.value).toBe("BASE");
  });

  it("ベースレコードがなければundefinedを返す", () => {
    const records = [makeRecord({ 区分: "オプション" })];
    expect(findBaseRecord(records)).toBeUndefined();
  });
});

describe("buildCurrentContractSummary", () => {
  it("ベースレコードから法人名・プラン・ユーザー数を組み立てる", () => {
    const records = [
      makeRecord({ 区分: "ベース", 顧客名: "株式会社テスト", 種類２: "プレミアム", 数量: "20" }),
      makeRecord({ 区分: "オプション" }),
    ];
    expect(buildCurrentContractSummary(records)).toEqual({
      corporateName: "株式会社テスト",
      currentPlan: "プレミアム",
      currentUserCount: "20",
    });
  });

  it("ベースレコードがない場合はundefinedを返す", () => {
    expect(buildCurrentContractSummary([makeRecord({ 区分: "オプション" })])).toBeUndefined();
  });
});

describe("buildLineItems", () => {
  it("各レコードを明細行データへ変換する", () => {
    const records = [
      makeRecord({
        サービス名_請求書用: "商品A",
        製品型番: "CODE-A",
        単価_月額_税抜: "500",
        数量: "3",
      }),
    ];
    expect(buildLineItems(records)).toEqual([
      { productName: "商品A", productCode: "CODE-A", unitPrice: "500", currentQuantity: "3" },
    ]);
  });

  it("レコードが0件なら空配列を返す", () => {
    expect(buildLineItems([])).toEqual([]);
  });
});
