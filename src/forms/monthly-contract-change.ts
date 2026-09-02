// 【クラウド版】注文書兼利用申込書（月額：契約変更）フォーム専用カスタマイズ。
// フェーズ1の各ステップ（a, b, c, e, f）はこのファイルに順次イベントハンドラーを追加していく。
// 参照: docs/plans/2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md
//
// ===== ステップa: インスタンス名UI + kintoneから現在契約情報を取得・表示 =====

import {
  buildCurrentContractSummary,
  buildLineItems,
  computeEarliestAllowedApplyMonth,
  extractUniqueInstances,
  filterActiveMonthlyRecords,
  filterRecordsByInstance,
  isApplyMonthSelectionAllowed,
  toContractRecord,
  type ContractRecord,
  type RawKintoneRecord,
} from "./monthly-contract-change-logic";
import { JAPAN_HOLIDAYS } from "./japan-holidays";

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

const CHANGE_APPLY_YEAR_PART_ID = "fidChangeApplyYear";
const CHANGE_APPLY_MONTH_PART_ID = "fidChangeApplyMonth";

const CANCEL_CHECKBOX_PART_ID = "fidProductCancel";
// チェックボックスのチェック時表示コメント（docs/forms/json/【クラウド版】注文書兼利用申込書（月額：契約変更）.json:159参照）。
// parts.valueは選択状態に応じてこの文字列（または未チェック時の"継続"）が返る仕様。
const CANCEL_CHECKED_VALUE = "解約";

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

// kintoneから取得した全レコードの中に「現在有効な月額契約」（区分=ベース かつ 月額年額=月額 かつ
// 契約ステータス2=契約中）が1件もない場合に立てるフラグ（例：対象レコードが契約ステータス2=切替等の
// 別ステータスになっているケース。TC-18の実機確認結果を受けてフェイルセーフとして追加）。
// baseRecordMissingは「選択中インスタンスにベースレコードがない」ケース、こちらは
// 「有効なインスタンスの選択肢自体が1件もない」ケースであり原因が異なるため別名で管理する。
let noActiveContractFound = false;

const NO_ACTIVE_CONTRACT_MESSAGE =
  "現在契約中の契約情報が取得できませんでした。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// 明細行数がフォームの明細テーブル最大行数を超えた場合（運用上は起こらない想定だが、TC-21の実機確認結果を
// 受けてフェイルセーフとして追加）に立てるフラグ。インスタンス切り替えで行数が収まった場合はfalseにリセットする。
let lineItemsExceedTableCapacity = false;

const LINE_ITEMS_EXCEED_CAPACITY_MESSAGE =
  "明細行数がフォームの上限を超えているため、全ての商品を表示できません。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// kintone-contract-dbエンドポイントの呼び出しに失敗した場合（プロキシ側エラー・通信エラーいずれも。
// TC-23の実機確認結果を受けてフェイルセーフとして追加）に立てるフラグ。
let kintoneCallFailed = false;

const KINTONE_CALL_FAILED_MESSAGE =
  "契約情報の取得に失敗しました。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

// 解約チェック連動で「変更後契約数」入力欄をロックする際のDOM操作に失敗した場合
// （DOM構造不一致。ステップbの実装で追加）に立てるフラグ。
let cancelQuantityLockFailed = false;

const CANCEL_QUANTITY_LOCK_FAILURE_MESSAGE =
  "解約チェックに連動した入力欄のロックに失敗しました。お手数ですがシステム管理者にお問い合わせください（このままでは申請できません）。";

const CHANGE_APPLY_MONTH_TOO_EARLY_MESSAGE =
  "選択された変更適用希望年月では申請できません。当月分は申込期限（当月最終営業日から3営業日前）を過ぎているため、翌月以降を選択してください。";

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
    lineItemsExceedTableCapacity = true;
    alert(LINE_ITEMS_EXCEED_CAPACITY_MESSAGE);
  } else {
    lineItemsExceedTableCapacity = false;
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
 * 単一インスタンス時、ネイティブのテキスト入力欄をreadOnly化してユーザーによる直接編集を防止する
 * （DOM構造に直接依存する非公式実装。TC-19の実機確認結果を受けて対応）。
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
      "[monthly-contract-change] インスタンス名入力欄のロックに失敗しました。" +
        "DOM構造が想定と異なります（コラボフォームのUIライブラリのバージョンアップ等が原因の可能性）。" +
        ` nativeInput=${String(nativeInput)}`
    );
    alert(INSTANCE_SELECTOR_FAILURE_MESSAGE);
    return;
  }

  nativeInput.readOnly = true;
}

/**
 * 明細行の「変更後契約数」入力欄を解約チェック連動でロック/アンロックする
 * （DOM構造に直接依存する非公式実装。ステップbの実装で追加）。
 * 公式API（parts.enabled）はパーツの有効/無効を設定できない仕様のため、lockInstanceNameFieldと
 * 同じパターンでDOM操作により対応する。失敗時は cancelQuantityLockFailed を立て、
 * form.confirm / form.submit で申請自体をブロックする。
 */
function setChangedQuantityFieldLocked(rowIndex: number, locked: boolean): void {
  const nativeInput = document.getElementById(
    `table:${rowIndex}:${LINE_ITEM_COLUMN_PART_IDS.changedQuantity}`
  );

  if (!(nativeInput instanceof HTMLInputElement)) {
    cancelQuantityLockFailed = true;
    console.error(
      `[monthly-contract-change] ${rowIndex}行目の「変更後契約数」入力欄のロックに失敗しました。` +
        "DOM構造が想定と異なります（コラボフォームのUIライブラリのバージョンアップ等が原因の可能性）。" +
        ` nativeInput=${String(nativeInput)}`
    );
    alert(CANCEL_QUANTITY_LOCK_FAILURE_MESSAGE);
    return;
  }

  nativeInput.readOnly = locked;
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
    // 単一インスタンス時はプルダウンを使わず、テキスト入力をreadOnly化してインスタンス変更を防止する。
    lockInstanceNameField();
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
  // ネイティブinputと同じMantineクラスを付与し、フォントサイズ等の見た目を揃える（TC-19で発覚した表示崩れの対応）。
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

/**
 * 変更適用希望年月の選択値が、当日から計算した最早選択可能年月以上かを検証する
 * （ステップfの実装。当月選択可能期限日の定義は monthly-contract-change-logic.ts 参照）。
 * ドロップダウンの選択肢自体は制限せず、確認・送信のタイミングでブロックする方針
 * （fidChangeApplyMonthはMantineのSelectコンボボックスで選択肢一覧が開いた時のみ
 * DOMにレンダリングされ、選択肢を削除するDOM操作は非常に脆弱なため）。
 */
function validateChangeApplyMonth(data: CollaboformEventData): boolean {
  const selectedYear = Number(data.parts[CHANGE_APPLY_YEAR_PART_ID].value);
  const selectedMonth = Number(data.parts[CHANGE_APPLY_MONTH_PART_ID].value);

  if (Number.isNaN(selectedYear) || Number.isNaN(selectedMonth)) {
    return true;
  }

  if (isApplyMonthSelectionAllowed(selectedYear, selectedMonth, new Date(), JAPAN_HOLIDAYS)) {
    return true;
  }

  alert(CHANGE_APPLY_MONTH_TOO_EARLY_MESSAGE);
  return false;
}

const LOADING_OVERLAY_ID = "monthly-contract-change-loading-overlay";

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
  if (cancelQuantityLockFailed) {
    alert(CANCEL_QUANTITY_LOCK_FAILURE_MESSAGE);
    return false;
  }
  return true;
}

collaboform.events.on("form.show", function (data) {
  // 初期化処理（本ハンドラー全体）が完了するまでローディング表示で入力をブロックする。
  showLoadingOverlay();

  // ===== ステップf: 変更適用希望年月のデフォルト値 =====
  // kintone連携（インスタンス名・契約情報）とは独立した処理のため、プロキシ呼び出しの完了を待たず即時セットする。
  try {
    const earliestApplyMonth = computeEarliestAllowedApplyMonth(new Date(), JAPAN_HOLIDAYS);
    setPartValue(data, CHANGE_APPLY_YEAR_PART_ID, String(earliestApplyMonth.year));
    setPartValue(data, CHANGE_APPLY_MONTH_PART_ID, String(earliestApplyMonth.month));
  } catch (error) {
    console.error(
      "[monthly-contract-change] 変更適用希望年月のデフォルト値セットに失敗しました。",
      error
    );
    hideLoadingOverlay();
    throw error;
  }

  collaboform.proxy
    .call(KINTONE_CONTRACT_DB_ENDPOINT)
    .then(function (response) {
      if (!response.success) {
        console.error(
          `[monthly-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}の呼び出しに失敗しました。status=${response.status}`
        );
        kintoneCallFailed = true;
        alert(KINTONE_CALL_FAILED_MESSAGE);
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
        `[monthly-contract-change] ${KINTONE_CONTRACT_DB_ENDPOINT}への通信でエラーが発生しました。`
      );
      kintoneCallFailed = true;
      alert(KINTONE_CALL_FAILED_MESSAGE);
    })
    .finally(function () {
      hideLoadingOverlay();
    });
});

// ===== ステップb: 変更後契約数のデフォルト値／解約チェック連動 =====
// 「解約」チェックON時は変更後契約数を0固定・入力不可に、OFF時は現商品契約数を再セットして入力可能に戻す。
collaboform.events.on(`form.${CANCEL_CHECKBOX_PART_ID}.change`, function (data) {
  if (data.row_index === undefined) {
    return;
  }

  const tableRows = data.parts[TABLE_PART_ID].value as ContractLineItemRow[];
  const row = tableRows[data.row_index - 1];
  if (!row) {
    return;
  }

  const isCancelled = row[CANCEL_CHECKBOX_PART_ID].value === CANCEL_CHECKED_VALUE;
  row[LINE_ITEM_COLUMN_PART_IDS.changedQuantity].value = isCancelled
    ? "0"
    : row[LINE_ITEM_COLUMN_PART_IDS.currentQuantity].value;
  setChangedQuantityFieldLocked(data.row_index, isCancelled);
});

collaboform.events.on("form.confirm", function (data) {
  return blockSubmissionIfDataIssueDetected() && validateChangeApplyMonth(data);
});
collaboform.events.on("form.submit", function (data) {
  return blockSubmissionIfDataIssueDetected() && validateChangeApplyMonth(data);
});
