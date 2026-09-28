// 【クラウド版】注文書兼利用申込書（年額：契約変更）フォーム専用カスタマイズ。
// フェーズ4の各ステップ（a, b, c, d）はこのファイルに順次イベントハンドラーを追加していく
// （月額版のmonthly-contract-change.tsと同じ運用パターン）。
// 参照: docs/plans/2026-09-28_フェーズ4ステップa_年額版インスタンス名UIとkintone連携.md
//
// ===== ステップa: インスタンス名UI + kintoneから現在契約情報を取得・表示 =====

import {
  buildCurrentContractSummary,
  buildLineItems,
  extractUniqueInstances,
  filterActiveAnnualRecords,
  filterRecordsByInstance,
  toContractRecord,
  type ContractRecord,
  type RawKintoneRecord,
} from "./annual-contract-change-logic";

const KINTONE_CONTRACT_DB_ENDPOINT = "kintone-contract-db";

const INSTANCE_NAME_PART_ID = "fidContractedInstanceName";
const CORPORATE_NAME_PART_ID = "fidCorporateName";
const CURRENT_PLAN_PART_ID = "fidCurrentContractPlan";
const CURRENT_USER_COUNT_PART_ID = "fidCurrentContractUserCount";
const CONTRACT_EXPIRY_PART_ID = "fidCurrentContractExpiry";
const TABLE_PART_ID = "tbl_1";

type ContractLineItemRow = Record<string, CollaboformPartValue<string>>;

const LINE_ITEM_COLUMN_PART_IDS = {
  productName: "fidChangedProductName",
  productCode: "fidChangedProductCode",
  unitPrice: "fidChangedProductUnitPrice",
  currentQuantity: "fidCurrentProductQuantity",
  changedQuantity: "fidChangedProductQuantity",
} as const;

// kintoneから取得した「現在有効な年額契約」レコードのローカルキャッシュ。
// インスタンス切り替え時はここから再フィルタするだけで、kintoneへの再リクエストは行わない。
let activeAnnualRecordsCache: ContractRecord[] = [];

// 明細テーブルの行インデックス→区分（クラウド契約管理DBの`区分`）の対応キャッシュ（ステップc用）。
// 明細テーブルの行自体には区分を保持する専用パーツがないため、applyLineItemsToTableで
// テーブルへの反映と同時に更新する。
let currentLineItemCategories: string[] = [];

// ステップaのインスタンス選択プルダウン（DOM構造に依存する非公式実装）の構築に失敗した場合に立てるフラグ。
// b以降のステップで別の申請ブロック条件を追加する場合は、混在させず別名のフラグにすること。
let instanceSelectorInitFailed = false;

const INSTANCE_SELECTOR_FAILURE_MESSAGE =
  "契約インスタンスの選択UIが正しく表示できませんでした。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// 選択中インスタンスに区分=ベースのレコードが見つからない場合（データ不整合。運用上は起こらない想定だが
// kintone側の入力ミス等で発生しうるため、月額版TC-17の実機確認結果を受けてフェイルセーフとして追加）に
// 立てるフラグ。インスタンス切り替えで正常なレコードに戻った場合はfalseにリセットする。
let baseRecordMissing = false;

const BASE_RECORD_MISSING_MESSAGE =
  "選択されたインスタンスの契約情報（現在契約プラン等）が見つかりませんでした。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// kintoneから取得した全レコードの中に「現在有効な年額契約」（区分=ベース かつ 月額年額=年額 かつ
// 契約ステータス2=契約中）が1件もない場合に立てるフラグ（例：対象レコードが契約ステータス2=切替等の
// 別ステータスになっているケース。月額版TC-18の実機確認結果を受けてフェイルセーフとして追加）。
// baseRecordMissingは「選択中インスタンスにベースレコードがない」ケース、こちらは
// 「有効なインスタンスの選択肢自体が1件もない」ケースであり原因が異なるため別名で管理する。
let noActiveContractFound = false;

const NO_ACTIVE_CONTRACT_MESSAGE =
  "現在契約中の契約情報が取得できませんでした。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// 明細行数がフォームの明細テーブル最大行数を超えた場合（運用上は起こらない想定だが、月額版TC-21の
// 実機確認結果を受けてフェイルセーフとして追加）に立てるフラグ。インスタンス切り替えで行数が収まった
// 場合はfalseにリセットする。
let lineItemsExceedTableCapacity = false;

const LINE_ITEMS_EXCEED_CAPACITY_MESSAGE =
  "明細行数がフォームの上限を超えているため、全ての商品を表示できません。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// kintone-contract-dbエンドポイントの呼び出しに失敗した場合（プロキシ側エラー・通信エラーいずれも。
// 月額版TC-23の実機確認結果を受けてフェイルセーフとして追加）に立てるフラグ。
let kintoneCallFailed = false;

const KINTONE_CALL_FAILED_MESSAGE =
  "契約情報の取得に失敗しました。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

function setPartValue(data: CollaboformEventData, partId: string, value: string): void {
  data.parts[partId].value = value;
}

function applyInstanceData(instanceName: string, data: CollaboformEventData): void {
  const recordsForInstance = filterRecordsByInstance(activeAnnualRecordsCache, instanceName);

  const summary = buildCurrentContractSummary(recordsForInstance);
  if (summary) {
    setPartValue(data, CORPORATE_NAME_PART_ID, summary.corporateName);
    setPartValue(data, CURRENT_PLAN_PART_ID, summary.currentPlan);
    setPartValue(data, CURRENT_USER_COUNT_PART_ID, summary.currentUserCount);
    setPartValue(data, CONTRACT_EXPIRY_PART_ID, summary.contractExpiry);
    baseRecordMissing = false;
  } else {
    console.error(
      `[annual-contract-change] インスタンス「${instanceName}」に区分=ベースのレコードが見つかりませんでした。`
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
      `[annual-contract-change] 明細行数(${lineItems.length})がフォームの明細テーブル行数(${tableRows.length})を超えています。超過分は反映されません。`
    );
    lineItemsExceedTableCapacity = true;
    alert(LINE_ITEMS_EXCEED_CAPACITY_MESSAGE);
  } else {
    lineItemsExceedTableCapacity = false;
  }

  currentLineItemCategories = [];

  tableRows.forEach((row, index) => {
    const lineItem = lineItems[index];
    row[LINE_ITEM_COLUMN_PART_IDS.productName].value = lineItem ? lineItem.productName : "";
    row[LINE_ITEM_COLUMN_PART_IDS.productCode].value = lineItem ? lineItem.productCode : "";
    row[LINE_ITEM_COLUMN_PART_IDS.unitPrice].value = lineItem ? lineItem.unitPrice : "";
    row[LINE_ITEM_COLUMN_PART_IDS.currentQuantity].value = lineItem ? lineItem.currentQuantity : "";
    // 「変更後契約数」の初期値は現商品契約数と同じにする（要求事項：変更後契約数のデフォルトは現在の契約ユーザー数）。
    row[LINE_ITEM_COLUMN_PART_IDS.changedQuantity].value = lineItem ? lineItem.currentQuantity : "";
    // ステップc（オプションのユーザー数整合性チェック）用に区分を保持する。
    currentLineItemCategories[index] = lineItem ? lineItem.category : "";
  });
}

/**
 * 単一インスタンス時、ネイティブのテキスト入力欄をreadOnly化してユーザーによる直接編集を防止する
 * （DOM構造に直接依存する非公式実装。月額版TC-19の実機確認結果を受けた対応を踏襲）。
 * 公式API（parts.enabled）はパーツの有効/無効を設定できない仕様のため、DOM操作で対応する。
 * readOnlyはキーボード入力のみを防止し、コラボフォームがJS側で保持する値（parts.value、
 * 公式APIでセット済み）には影響しないため、送信される値は変わらない。
 * 失敗時は instanceSelectorInitFailed を立て、form.confirm / form.submit で申請自体をブロックする。
 */
function lockInstanceNameField(): void {
  const nativeInput = document.getElementById(INSTANCE_NAME_PART_ID);

  if (!(nativeInput instanceof HTMLInputElement)) {
    instanceSelectorInitFailed = true;
    console.error(
      "[annual-contract-change] インスタンス名入力欄のロックに失敗しました。" +
        "DOM構造が想定と異なります（コラボフォームのUIライブラリのバージョンアップ等が原因の可能性）。" +
        ` nativeInput=${String(nativeInput)}`
    );
    alert(INSTANCE_SELECTOR_FAILURE_MESSAGE);
    return;
  }

  nativeInput.readOnly = true;
}

/**
 * 複数インスタンス時のプルダウン代替UIを構築する（DOM構造に直接依存する非公式実装）。
 * リスク: コラボフォームのUIライブラリ（Mantine）がバージョンアップ等でDOM構造・クラス名を
 * 変更した場合、動作しなくなる可能性がある。要求事項の実現に必要な措置として実施する
 * （月額版と同じ実装パターン。詳細は
 * docs/plans/2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md 参照）。
 * 失敗時は instanceSelectorInitFailed を立て、form.confirm / form.submit で申請自体をブロックする
 * （ブロック機構自体は公式イベントAPIを使うためDOM構造の変化の影響を受けない）。
 */
function buildInstanceSelector(instances: string[], data: CollaboformEventData): void {
  if (instances.length <= 1) {
    // 単一インスタンス時はプルダウンを使わず、テキスト入力をreadOnly化してインスタンス変更を防止する。
    lockInstanceNameField();
    return;
  }

  const nativeInput = document.getElementById(INSTANCE_NAME_PART_ID);
  const wrapper = nativeInput ? nativeInput.closest(".mantine-Input-wrapper") : null;

  if (!(nativeInput instanceof HTMLElement) || !(wrapper instanceof HTMLElement)) {
    instanceSelectorInitFailed = true;
    console.error(
      "[annual-contract-change] インスタンス選択プルダウンの構築に失敗しました。" +
        "DOM構造が想定と異なります（コラボフォームのUIライブラリのバージョンアップ等が原因の可能性）。" +
        ` nativeInput=${String(nativeInput)}, wrapper=${String(wrapper)}`
    );
    alert(INSTANCE_SELECTOR_FAILURE_MESSAGE);
    return;
  }

  nativeInput.style.display = "none";

  const select = document.createElement("select");
  select.setAttribute("data-role", "instance-selector-fallback");
  // ネイティブinputと同じMantineクラスを付与し、フォントサイズ等の見た目を揃える（月額版TC-19の教訓）。
  select.className = nativeInput.className;
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

const LOADING_OVERLAY_ID = "annual-contract-change-loading-overlay";

/**
 * 初期化処理（kintone連携等）が完了するまで、画面全体を覆うローディング表示を追加し
 * 入力・クリックをブロックする。既存パーツのDOM構造には依存せず要素を自前で生成するため、
 * 他のDOM操作（lockInstanceNameField等）と異なりDOM構造不一致による失敗リスクはない。
 * position:fixedによりスクロールしても常に画面全体を覆う。
 */
function showLoadingOverlay(): void {
  if (document.getElementById(LOADING_OVERLAY_ID)) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = LOADING_OVERLAY_ID;
  overlay.setAttribute("aria-live", "polite");
  overlay.style.cssText =
    "position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;" +
    "display:flex;align-items:center;justify-content:center;" +
    "background:rgba(255,255,255,0.85);";

  const message = document.createElement("div");
  message.textContent = "読み込み中です。しばらくお待ちください…";
  message.style.cssText =
    "font-size:16px;color:#23221F;background:#fff;padding:16px 24px;border-radius:4px;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.2);";

  overlay.appendChild(message);
  document.body.appendChild(overlay);
}

/** {@link showLoadingOverlay} で追加したローディング表示を削除する。 */
function hideLoadingOverlay(): void {
  document.getElementById(LOADING_OVERLAY_ID)?.remove();
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
  if (noActiveContractFound) {
    alert(NO_ACTIVE_CONTRACT_MESSAGE);
    return false;
  }
  if (lineItemsExceedTableCapacity) {
    alert(LINE_ITEMS_EXCEED_CAPACITY_MESSAGE);
    return false;
  }
  if (kintoneCallFailed) {
    alert(KINTONE_CALL_FAILED_MESSAGE);
    return false;
  }
  return true;
}

collaboform.events.on("form.show", function (data) {
  // 初期化処理（本ハンドラー全体）が完了するまでローディング表示で入力をブロックする。
  showLoadingOverlay();

  collaboform.proxy
    .call(KINTONE_CONTRACT_DB_ENDPOINT)
    .then(function (response) {
      if (!response.success) {
        console.error(
          `[annual-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}の呼び出しに失敗しました。status=${response.status}`
        );
        kintoneCallFailed = true;
        alert(KINTONE_CALL_FAILED_MESSAGE);
        return;
      }

      const body = response.body as { records?: RawKintoneRecord[] };
      const contractRecords = (body.records ?? []).map(toContractRecord);
      activeAnnualRecordsCache = filterActiveAnnualRecords(contractRecords);

      const instances = extractUniqueInstances(activeAnnualRecordsCache);
      if (instances.length === 0) {
        console.error(
          `[annual-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}から現在契約中の年額レコードが取得できませんでした。`
        );
        noActiveContractFound = true;
        alert(NO_ACTIVE_CONTRACT_MESSAGE);
        return;
      }

      const defaultInstance = instances[0];
      setPartValue(data, INSTANCE_NAME_PART_ID, defaultInstance);
      buildInstanceSelector(instances, data);
      applyInstanceData(defaultInstance, data);
    })
    .catch(function () {
      console.error(
        `[annual-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}への通信でエラーが発生しました。`
      );
      kintoneCallFailed = true;
      alert(KINTONE_CALL_FAILED_MESSAGE);
    })
    .finally(function () {
      hideLoadingOverlay();
    });
});

collaboform.events.on("form.confirm", function () {
  return blockSubmissionIfDataIssueDetected();
});
collaboform.events.on("form.submit", function () {
  return blockSubmissionIfDataIssueDetected();
});
