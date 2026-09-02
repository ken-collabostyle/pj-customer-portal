import { describe, expect, it } from "vitest";
import {
  buildCurrentContractSummary,
  buildLineItems,
  CONTRACT_DB_FIELD_CODES,
  extractUniqueInstances,
  filterActiveMonthlyRecords,
  filterRecordsByInstance,
  findBaseRecord,
  isActiveMonthlyRecord,
  toContractRecord,
  type ContractRecord,
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
