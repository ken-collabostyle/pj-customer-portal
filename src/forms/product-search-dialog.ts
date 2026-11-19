// 新規追加商品の検索ダイアログ（DOM操作部分）。lookupパーツの代替として、テキストパーツに虫眼鏡を付け、
// クリックで商品マスタ（kintone、プロキシAPI経由）を検索するサブウィンドウ（モーダル）を開く。
// コラボフォームのUIライブラリ（Mantine）のDOM構造に依存する非公式実装。
// 参照: docs/plans/2026-11-19_新規追加商品名のlookupからテキストパーツ+JS検索への置き換え.md
import {
  buildProductSearchQuery,
  type ProductBillingCycle,
  resolvePlanDisplayFlagField,
  toProductSearchRows,
  type ProductSearchResultRow,
  type RawProductMasterRecord,
} from "./product-search-logic";

export interface ProductSearchConfig {
  /** 商品マスタ検索用プロキシAPIのエンドポイントコード。 */
  endpoint: string;
  /** 検索対象の「月額／年額」（月額版フォームは「月額」、年額版フォームは「年額」）。 */
  billingCycle: ProductBillingCycle;
  /** `data.parts`上の明細テーブルのパーツID（例：`tbl_1`）。 */
  tablePartId: string;
  /** DOM上のパーツid接頭辞（例：`table`。`table:1:fidAddedProductName`の`table`部分）。 */
  domRowIdPrefix: string;
  namePartId: string;
  codePartId: string;
  unitPricePartId: string;
  categoryPartId: string;
  /** 年額版のみ。按分月数をセットするパーツID。 */
  proratedMonthsPartId?: string;
  /** 絞り込みに使うベースライセンス（現在契約プラン名）を返す。 */
  getPlanName: () => string;
  /** 行選択時の値セット先となるフォームデータ（form.showで受け取ったdata）を返す。 */
  getFormData: () => CollaboformEventData | undefined;
}

const DECORATED_ATTR = "data-product-search-decorated";
const DIALOG_ID = "product-search-dialog-overlay";

type Row = Record<string, CollaboformPartValue<string>>;

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration> = {},
  text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  Object.assign(el.style, styles);
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

function applyRowSelection(
  config: ProductSearchConfig,
  rowIndex: number,
  row: ProductSearchResultRow
): boolean {
  const data = config.getFormData();
  const tableRows = data?.parts[config.tablePartId]?.value as Row[] | undefined;
  const target = tableRows?.[rowIndex - 1];
  if (!target) {
    return false;
  }
  target[config.namePartId].value = row.productName;
  target[config.codePartId].value = row.productCode;
  target[config.unitPricePartId].value = row.unitPrice;
  target[config.categoryPartId].value = row.category;
  if (config.proratedMonthsPartId) {
    target[config.proratedMonthsPartId].value = row.proratedMonths;
  }
  return true;
}

function closeDialog(): void {
  document.getElementById(DIALOG_ID)?.remove();
}

function renderResults(
  container: HTMLElement,
  rows: ProductSearchResultRow[],
  onSelect: (row: ProductSearchResultRow) => void
): void {
  container.textContent = "";
  if (rows.length === 0) {
    container.appendChild(createEl("div", { padding: "12px", color: "#666" }, "該当する商品がありません。"));
    return;
  }
  const table = createEl("table", { width: "100%", borderCollapse: "collapse", fontSize: "14px" });
  const head = createEl("tr");
  for (const label of ["メーカー型番", "商品名", "標準売価"]) {
    head.appendChild(
      createEl("th", { textAlign: "left", padding: "6px", borderBottom: "2px solid #ccc" }, label)
    );
  }
  table.appendChild(head);
  for (const row of rows) {
    const tr = createEl("tr", { cursor: "pointer" });
    tr.addEventListener("mouseenter", () => (tr.style.backgroundColor = "#e7f5ff"));
    tr.addEventListener("mouseleave", () => (tr.style.backgroundColor = ""));
    tr.addEventListener("click", () => onSelect(row));
    const price = row.unitPrice === "" ? "" : Number(row.unitPrice).toLocaleString("ja-JP");
    for (const [text, align] of [
      [row.productCode, "left"],
      [row.productName, "left"],
      [price, "right"],
    ] as const) {
      tr.appendChild(
        createEl("td", { padding: "6px", borderBottom: "1px solid #eee", textAlign: align }, text)
      );
    }
    table.appendChild(tr);
  }
  container.appendChild(table);
}

function openDialog(config: ProductSearchConfig, rowIndex: number): void {
  closeDialog();

  const flagField = resolvePlanDisplayFlagField(config.getPlanName());
  if (!flagField) {
    alert(
      "現在のご契約プランに対応する商品を特定できないため、商品を検索できません。" +
        "お手数ですがシステム管理者にお問い合わせください。"
    );
    return;
  }

  const overlay = createEl("div", {
    position: "fixed",
    inset: "0",
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: "10000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  overlay.id = DIALOG_ID;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeDialog();
    }
  });

  const panel = createEl("div", {
    backgroundColor: "#fff",
    borderRadius: "6px",
    padding: "16px",
    width: "min(720px, 92vw)",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  });
  panel.appendChild(createEl("div", { fontWeight: "bold", fontSize: "16px" }, "商品検索"));

  const form = createEl("div", { display: "flex", gap: "8px" });
  const input = createEl("input", { flex: "1", padding: "6px 8px", fontSize: "14px" });
  input.type = "text";
  input.placeholder = "商品名で検索（空欄の場合は全件表示）";
  const searchButton = createEl("button", { padding: "6px 16px" }, "検索");
  searchButton.type = "button";
  const closeButton = createEl("button", { padding: "6px 16px" }, "閉じる");
  closeButton.type = "button";
  closeButton.addEventListener("click", closeDialog);
  form.append(input, searchButton, closeButton);
  panel.appendChild(form);

  const results = createEl("div", { overflowY: "auto", minHeight: "80px" });
  panel.appendChild(results);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  input.focus();

  const search = (): void => {
    results.textContent = "検索中...";
    searchButton.disabled = true;
    collaboform.proxy
      .call(config.endpoint, { query: { query: buildProductSearchQuery(input.value, flagField, config.billingCycle) } })
      .then((response) => {
        if (!response.success) {
          console.error(`[product-search] 検索に失敗しました。status=${response.status}`);
          results.textContent = "商品の検索に失敗しました。時間をおいて再度お試しください。";
          return;
        }
        const body = response.body as { records?: RawProductMasterRecord[] };
        renderResults(results, toProductSearchRows(body.records ?? []), (row) => {
          if (applyRowSelection(config, rowIndex, row)) {
            closeDialog();
          } else {
            alert("商品の反映に失敗しました。お手数ですがシステム管理者にお問い合わせください。");
          }
        });
      })
      .catch((error: unknown) => {
        console.error("[product-search] 検索中に通信エラーが発生しました。", error);
        results.textContent = "商品の検索に失敗しました。時間をおいて再度お試しください。";
      })
      .finally(() => {
        searchButton.disabled = false;
      });
  };

  searchButton.addEventListener("click", search);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });
  // 開いた時点で固定条件による一覧を表示する。
  search();
}

function decorateInput(config: ProductSearchConfig, input: HTMLInputElement, rowIndex: number): void {
  input.setAttribute(DECORATED_ATTR, "true");
  input.readOnly = true;
  input.style.cursor = "pointer";
  input.placeholder = "クリックして商品を検索";
  input.addEventListener("click", () => openDialog(config, rowIndex));

  const wrapper = input.closest(".mantine-Input-wrapper");
  if (wrapper instanceof HTMLElement) {
    wrapper.style.position = "relative";
    const icon = createEl(
      "span",
      {
        position: "absolute",
        right: "8px",
        top: "50%",
        transform: "translateY(-50%)",
        opacity: "0.35",
        cursor: "pointer",
        pointerEvents: "auto",
        fontSize: "16px",
      },
      "🔍"
    );
    icon.setAttribute("aria-label", "商品を検索");
    icon.addEventListener("click", () => openDialog(config, rowIndex));
    wrapper.appendChild(icon);
  }
}

/** 追加商品名の入力欄へ虫眼鏡と検索ダイアログを取り付ける。DOMの再描画に備えMutationObserverで繰り返し適用する。 */
export function attachProductSearch(config: ProductSearchConfig): void {
  const idPattern = new RegExp(`^${config.domRowIdPrefix}:(\\d+):${config.namePartId}$`);

  const decorateAll = (): void => {
    document.querySelectorAll<HTMLInputElement>(`input[id$=":${config.namePartId}"]`).forEach((input) => {
      const match = idPattern.exec(input.id);
      if (match && !input.hasAttribute(DECORATED_ATTR)) {
        decorateInput(config, input, Number(match[1]));
      }
    });
  };

  decorateAll();
  new MutationObserver(decorateAll).observe(document.body, { childList: true, subtree: true });
}
