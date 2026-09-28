// 契約変更フォーム（月額・年額）で共通の汎用ロジック（DOM・collaboform APIに依存しない部分）。
// フォーム固有のフィールドコード・パーツIDには依存しない関数のみを置く
// （docs/plans/2026-09-25_フェーズ4_年額契約変更カスタマイズ計画.md「アーキテクチャ方針」参照）。

/** 「ベース」区分を表す定数。既存契約行のベース行判定（`findBaseRecord`等）とオプション整合性チェックの両方から参照する。 */
export const BASE_CATEGORY = "ベース";

// ===== 全般バリデーション：オプションのユーザー数整合性 =====
// 要求事項：「オプションがユーザーライセンス形式の場合、オプションのライセンス数が、
// ベースライセンスと同じユーザー数になっているかをチェックする。」
// 対象「区分」・解約行の扱い等は2026-09-11/16にユーザー確認済み
// （docs/plans/2026-09-11_フェーズ1ステップe_オプションユーザー数整合性チェック.md参照）。

/** ユーザーライセンス形式とみなす「区分」の値（2026-09-11ユーザー確認済み：オプション系すべて）。 */
export const OPTION_CATEGORIES = [
  "オプション",
  "オプション（ライセンスキー不要）",
  "オプション（転記不要）",
] as const;

function isOptionCategory(category: string): boolean {
  return (OPTION_CATEGORIES as readonly string[]).includes(category);
}

/** 数量の比較。kintone/コラボフォームの数値パーツは文字列で値が渡されるため数値として比較する。 */
function quantitiesMatch(a: string, b: string): boolean {
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isNaN(numA) || Number.isNaN(numB)) {
    return a === b;
  }
  return numA === numB;
}

/** 既存契約行（明細テーブル「1. 変更後契約数」列側）のうち、本チェックに必要な最小限のデータ。 */
export interface ExistingLineItemForValidation {
  category: string;
  changedQuantity: string;
  isCancelled: boolean;
}

/** 新規追加行（明細テーブル「2. オプション等新規追加」列側）のうち、本チェックに必要な最小限のデータ。 */
export interface AddedLineItemForValidation {
  category: string;
  quantity: string;
}

export interface UserCountMismatch {
  source: "existing" | "added";
  /** 1始まりの行番号（既存行・新規追加行それぞれの配列内でのインデックス）。 */
  rowIndex: number;
  category: string;
  quantity: string;
}

/**
 * オプション（ユーザーライセンス形式）の数量が、ベースライセンスの数量と一致しない行を検出する。
 * ベース行が存在しない、またはベース行が解約済みの場合は比較基準がないためチェックをスキップする
 * （2026-09-16ユーザー確認済み）。解約済みの既存行はチェック対象外（意図的な0のため）。
 * 新規追加行に「区分」が空（未入力行）または「ベース」が入っている場合はチェック対象外とする
 * （新規追加でベースを扱うことは想定しないため、想定外入力として無視する）。
 */
export function findUserCountMismatches(
  existingRows: ExistingLineItemForValidation[],
  addedRows: AddedLineItemForValidation[]
): UserCountMismatch[] {
  const baseRow = existingRows.find(
    (row) => row.category === BASE_CATEGORY && !row.isCancelled
  );
  if (!baseRow) {
    return [];
  }
  const baseQuantity = baseRow.changedQuantity;

  const mismatches: UserCountMismatch[] = [];

  existingRows.forEach((row, index) => {
    if (row.isCancelled || !isOptionCategory(row.category)) {
      return;
    }
    if (!quantitiesMatch(row.changedQuantity, baseQuantity)) {
      mismatches.push({
        source: "existing",
        rowIndex: index + 1,
        category: row.category,
        quantity: row.changedQuantity,
      });
    }
  });

  addedRows.forEach((row, index) => {
    if (!isOptionCategory(row.category)) {
      return;
    }
    if (!quantitiesMatch(row.quantity, baseQuantity)) {
      mismatches.push({
        source: "added",
        rowIndex: index + 1,
        category: row.category,
        quantity: row.quantity,
      });
    }
  });

  return mismatches;
}

// ===== 変更適用希望年月：デフォルト値・選択可能範囲 =====
// 祝日データはsrc/forms/japan-holidays.tsを参照。営業日計算はここでは祝日Setを引数で受け取るのみで、
// 具体的な祝日データには依存しない（ユニットテストで任意の祝日データを注入できるようにするため）。

export interface ApplyMonth {
  year: number;
  month: number; // 1-12
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 土日でも祝日（`holidays`に含まれる日付）でもなければ営業日とみなす。 */
export function isBusinessDay(date: Date, holidays: ReadonlySet<string>): boolean {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return !isWeekend && !holidays.has(toDateKey(date));
}

/** 指定年月の営業日一覧を日付昇順で返す。 */
export function getBusinessDaysOfMonth(
  year: number,
  month: number,
  holidays: ReadonlySet<string>
): Date[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const businessDays: Date[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (isBusinessDay(date, holidays)) {
      businessDays.push(date);
    }
  }
  return businessDays;
}

/**
 * 指定年月の「最終営業日から数えて3番目（3rd-from-last）の営業日」を返す。
 * 「月末から3営業日前になったら翌月以降のみ選択可」という当月選択可能期限日として使用する。
 * 当月の営業日が3日未満という稀なケースでは、その月の最初の営業日を基準とする。
 */
export function getCutoffBusinessDay(
  year: number,
  month: number,
  holidays: ReadonlySet<string>
): Date | undefined {
  const businessDays = getBusinessDaysOfMonth(year, month, holidays);
  if (businessDays.length === 0) {
    return undefined;
  }
  return businessDays[Math.max(0, businessDays.length - 3)];
}

/**
 * 変更適用希望年月として選択可能な最も早い年月を計算する。
 * 当月選択可能期限日（{@link getCutoffBusinessDay}）以降（当日を含む）は翌月、
 * それより前なら当月を返す。12月から翌年1月への年またぎにも対応する。
 */
export function computeEarliestAllowedApplyMonth(
  today: Date,
  holidays: ReadonlySet<string>
): ApplyMonth {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const cutoff = getCutoffBusinessDay(year, month, holidays);
  const isOnOrAfterCutoff = cutoff !== undefined && toDateKey(today) >= toDateKey(cutoff);

  if (!isOnOrAfterCutoff) {
    return { year, month };
  }
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * 選択された変更適用希望年月が、現在の日付から計算した最早選択可能年月以上かどうかを判定する。
 */
export function isApplyMonthSelectionAllowed(
  selectedYear: number,
  selectedMonth: number,
  today: Date,
  holidays: ReadonlySet<string>
): boolean {
  const earliest = computeEarliestAllowedApplyMonth(today, holidays);
  if (selectedYear !== earliest.year) {
    return selectedYear > earliest.year;
  }
  return selectedMonth >= earliest.month;
}
