// 【クラウド版】注文書兼利用申込書（月額：契約変更）フォーム専用カスタマイズ。
// フェーズ1の各ステップ（a, b, c, e, f）はこのファイルに順次イベントハンドラーを追加していく。
// 参照: docs/plans/2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md
//
// ===== ステップa: インスタンス名UI + kintoneから現在契約情報を取得・表示 =====

import {
  buildCurrentContractSummary,
  buildLineItems,
  extractUniqueInstances,
  filterActiveMonthlyRecords,
  filterRecordsByInstance,
  toContractRecord,
  type ContractRecord,
  type RawKintoneRecord,
} from "./monthly-contract-change-logic";

const KINTONE_CONTRACT_DB_ENDPOINT = "kintone-contract-db";

const INSTANCE_NAME_PART_ID = "fidContractedInstanceName";
const CORPORATE_NAME_PART_ID = "fidCorporateName";
const CURRENT_PLAN_PART_ID = "fidCurrentContractPlan";
const CURRENT_USER_COUNT_PART_ID = "fidCurrentContractUserCount";
const TABLE_PART_ID = "tbl_1";

type ContractLineItemRow = Record<string, CollaboformPartValue<string>>;

const LINE_ITEM_COLUMN_PART_IDS = {
  productName: "fidChangedProductName",
  productCode: "fidChangedProductCode",
  unitPrice: "fidChangedProductUnitPrice",
  currentQuantity: "fidCurrentProductQuantity",
  changedQuantity: "fidChangedProductQuantity",
} as const;

// kintoneから取得した「現在有効な月額契約」レコードのローカルキャッシュ。
// インスタンス切り替え時はここから再フィルタするだけで、kintoneへの再リクエストは行わない。
let activeMonthlyRecordsCache: ContractRecord[] = [];

// ステップaのインスタンス選択プルダウン（DOM構造に依存する非公式実装）の構築に失敗した場合に立てるフラグ。
// b以降のステップで別の申請ブロック条件を追加する場合は、混在させず別名のフラグにすること。
let instanceSelectorInitFailed = false;

const INSTANCE_SELECTOR_FAILURE_MESSAGE =
  "契約インスタンスの選択UIが正しく表示できませんでした。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// 選択中インスタンスに区分=ベースのレコードが見つからない場合（データ不整合。運用上は起こらない想定だが
// kintone側の入力ミス等で発生しうるため、TC-17の実機確認結果を受けてフェイルセーフとして追加）に立てるフラグ。
// instanceSelectorInitFailedとは原因が異なるため、混在させず別名で管理する。インスタンス切り替えで
// 正常なレコードに戻った場合はfalseにリセットする。
let baseRecordMissing = false;

const BASE_RECORD_MISSING_MESSAGE =
  "選択されたインスタンスの契約情報（現在契約プラン等）が見つかりませんでした。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

function setPartValue(data: CollaboformEventData, partId: string, value: string): void {
  data.parts[partId].value = value;
}

function applyInstanceData(instanceName: string, data: CollaboformEventData): void {
  const recordsForInstance = filterRecordsByInstance(activeMonthlyRecordsCache, instanceName);

  const summary = buildCurrentContractSummary(recordsForInstance);
  if (summary) {
    setPartValue(data, CORPORATE_NAME_PART_ID, summary.corporateName);
    setPartValue(data, CURRENT_PLAN_PART_ID, summary.currentPlan);
    setPartValue(data, CURRENT_USER_COUNT_PART_ID, summary.currentUserCount);
    baseRecordMissing = false;
  } else {
    console.error(
      `[monthly-contract-change] インスタンス「${instanceName}」に区分=ベースのレコードが見つかりませんでした。`
    );
    baseRecordMissing = true;
    alert(BASE_RECORD_MISSING_MESSAGE);
  }

  applyLineItemsToTable(buildLineItems(recordsForInstance), data);
}

function applyLineItemsToTable(
  lineItems: ReturnType<typeof buildLineItems>,
  data: CollaboformEventData
): void {
  const tableRows = data.parts[TABLE_PART_ID].value as ContractLineItemRow[];

  if (lineItems.length > tableRows.length) {
    console.warn(
      `[monthly-contract-change] 明細行数(${lineItems.length})がフォームの明細テーブル行数(${tableRows.length})を超えています。超過分は反映されません。`
    );
  }

  tableRows.forEach((row, index) => {
    const lineItem = lineItems[index];
    row[LINE_ITEM_COLUMN_PART_IDS.productName].value = lineItem ? lineItem.productName : "";
    row[LINE_ITEM_COLUMN_PART_IDS.productCode].value = lineItem ? lineItem.productCode : "";
    row[LINE_ITEM_COLUMN_PART_IDS.unitPrice].value = lineItem ? lineItem.unitPrice : "";
    row[LINE_ITEM_COLUMN_PART_IDS.currentQuantity].value = lineItem ? lineItem.currentQuantity : "";
    // 「変更後契約数」の初期値は現商品契約数と同じにする（要求事項：変更後契約数のデフォルトは現在の契約ユーザー数）。
    row[LINE_ITEM_COLUMN_PART_IDS.changedQuantity].value = lineItem ? lineItem.currentQuantity : "";
  });
}

/**
 * 複数インスタンス時のプルダウン代替UIを構築する（DOM構造に直接依存する非公式実装）。
 * リスク: コラボフォームのUIライブラリ（Mantine）がバージョンアップ等でDOM構造・クラス名を
 * 変更した場合、動作しなくなる可能性がある。要求事項の実現に必要な措置として実施する。
 * 失敗時は instanceSelectorInitFailed を立て、form.confirm / form.submit で申請自体をブロックする
 * （ブロック機構自体は公式イベントAPIを使うためDOM構造の変化の影響を受けない。詳細は
 * docs/plans/2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md 参照）。
 */
function buildInstanceSelector(instances: string[], data: CollaboformEventData): void {
  if (instances.length <= 1) {
    // 単一インスタンス時は公式API（parts経由）のみで完結するため、DOM操作は行わない。
    return;
  }

  const nativeInput = document.getElementById(INSTANCE_NAME_PART_ID);
  const wrapper = nativeInput ? nativeInput.closest(".mantine-Input-wrapper") : null;

  if (!(nativeInput instanceof HTMLElement) || !(wrapper instanceof HTMLElement)) {
    instanceSelectorInitFailed = true;
    console.error(
      "[monthly-contract-change] インスタンス選択プルダウンの構築に失敗しました。" +
        "DOM構造が想定と異なります（コラボフォームのUIライブラリのバージョンアップ等が原因の可能性）。" +
        ` nativeInput=${String(nativeInput)}, wrapper=${String(wrapper)}`
    );
    alert(INSTANCE_SELECTOR_FAILURE_MESSAGE);
    return;
  }

  nativeInput.style.display = "none";

  const select = document.createElement("select");
  select.setAttribute("data-role", "instance-selector-fallback");
  for (const instance of instances) {
    const option = document.createElement("option");
    option.value = instance;
    option.textContent = instance;
    select.appendChild(option);
  }
  select.value = instances[0];
  select.addEventListener("change", () => {
    setPartValue(data, INSTANCE_NAME_PART_ID, select.value);
    applyInstanceData(select.value, data);
  });

  wrapper.appendChild(select);
}

function blockSubmissionIfDataIssueDetected(): boolean {
  if (instanceSelectorInitFailed) {
    alert(INSTANCE_SELECTOR_FAILURE_MESSAGE);
    return false;
  }
  if (baseRecordMissing) {
    alert(BASE_RECORD_MISSING_MESSAGE);
    return false;
  }
  return true;
}

collaboform.events.on("form.show", function (data) {
  collaboform.proxy
    .call(KINTONE_CONTRACT_DB_ENDPOINT)
    .then(function (response) {
      if (!response.success) {
        console.error(
          `[monthly-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}の呼び出しに失敗しました。status=${response.status}`
        );
        return;
      }

      const body = response.body as { records?: RawKintoneRecord[] };
      const contractRecords = (body.records ?? []).map(toContractRecord);
      activeMonthlyRecordsCache = filterActiveMonthlyRecords(contractRecords);

      const instances = extractUniqueInstances(activeMonthlyRecordsCache);
      if (instances.length === 0) {
        console.error(
          `[monthly-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}から現在契約中の月額レコードが取得できませんでした。`
        );
        return;
      }

      const defaultInstance = instances[0];
      setPartValue(data, INSTANCE_NAME_PART_ID, defaultInstance);
      buildInstanceSelector(instances, data);
      applyInstanceData(defaultInstance, data);
    })
    .catch(function () {
      console.error(
        `[monthly-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}への通信でエラーが発生しました。`
      );
    });
});

collaboform.events.on("form.confirm", blockSubmissionIfDataIssueDetected);
collaboform.events.on("form.submit", blockSubmissionIfDataIssueDetected);
