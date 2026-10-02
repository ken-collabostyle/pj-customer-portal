---
type: plan
date: 2026-09-28
status: completed
tags: [顧客ポータル, 年額契約変更, kintone連携, フェーズ4]
related:
  - docs/plans/2026-09-25_フェーズ4_年額契約変更カスタマイズ計画.md
  - docs/plans/2026-09-28_フェーズ4_共通モジュール抽出.md
  - docs/plans/2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md
  - docs/forms/requirements/【クラウド版】注文書兼利用申込書（年額：契約変更）_実装メモ.md
  - docs/forms/requirements/【クラウド版】注文書兼利用申込書（年額：契約変更）_パーツID設計.md
  - docs/kintone/クラウド契約管理DB.md
  - src/forms/monthly-contract-change.ts
  - src/forms/monthly-contract-change-logic.ts
  - src/forms/contract-change-shared-logic.ts
  - src/forms/annual-contract-change-logic.ts
  - src/forms/annual-contract-change.ts
  - tests/forms/annual-contract-change-logic.test.ts
  - docs/agent-records/2026-09-28_フェーズ4ステップa_年額版インスタンス名UIとkintone連携_実装.md
---

# フェーズ4 ステップa 詳細計画：年額版インスタンス名UI＋kintoneから現在契約情報を取得・表示

[フェーズ4計画](2026-09-25_フェーズ4_年額契約変更カスタマイズ計画.md)フェーズ1のステップa。CLAUDE.md「1. 推論」の承認ゲートルールに基づき、実装着手前に本計画をユーザーの承認を得てから着手する。月額版[ステップa計画](2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md)と同じ実装パターンを踏襲する。

## 承認状況

承認済み（2026-09-28）

## 要求事項（該当箇所抜粋）

- ご契約中のインスタンス名（複数ある場合はプルダウン選択）
- 法人／団体名・現在契約プラン・現在契約ユーザー数をkintoneから取得・表示
- 契約期限（年額のみ新規）をkintoneから取得・表示
- 明細に現在契約商品を表示（既存契約分）

## スコープ（今回やること／やらないこと）

月額版ステップaと同様、本ステップでは以下のみを対象とする。

- **やること**：インスタンス名の代替プルダウンUI、kintone-contract-dbからの現在契約情報（法人名・現在契約プラン・現在契約ユーザー数・契約期限）取得、明細テーブルへの現在契約商品の表示（そのまま表示、変換なし）
- **やらないこと**（別ステップ・別フェーズ）：
  - 変更後契約数のデフォルト値／解約チェック連動 → ステップb
  - オプションのユーザー数整合性チェック → ステップc
  - 変更適用希望年月のデフォルト値・選択可能範囲 → ステップd
  - 「nヶ月分」商品の年間商品読み替え・減数解約禁止・妥当性チェック → フェーズ2（商品マスタ連携のブロッカー未解消のため対象外）

## 新規作成ファイル

月額版は1ファイル（`monthly-contract-change.ts`）にステップを順次追記する構成だが、年額版は別フォーム（別の.jsアップロード先）のため新規に2ファイルを作成する。

1. **`src/forms/annual-contract-change-logic.ts`**（純粋ロジック、DOM・collaboform APIに依存しない部分）
2. **`src/forms/annual-contract-change.ts`**（イベントハンドラー、DOM操作を含む）
3. **`tests/forms/annual-contract-change-logic.test.ts`**（1のユニットテスト）

## 実装方針

### 1. `annual-contract-change-logic.ts`

`monthly-contract-change-logic.ts`と同じ構造で、以下を実装する（フェーズ4計画のアーキテクチャ方針により、kintoneレコード変換・明細行構築はフォームごとに複製する対象のため、月額側からのimportはしない。`BASE_CATEGORY`のみ`contract-change-shared-logic.ts`からimportする）。

- `CONTRACT_DB_FIELD_CODES`：月額と同じフィールドコード対応表に、以下2点を反映
  - `unitPrice: "契約金額"`（月額の`単価_月額_税抜`ではなく`契約金額`を使う。[クラウド契約管理DB.md](../kintone/クラウド契約管理DB.md)「`月額年額`が『年額』の場合は`契約金額`を使う」2026-08-25ユーザー確認済みの記載に基づく）
  - `contractExpiry: "契約終了日"`（年額のみ新規、DATE型）
- `ContractRecord`インターフェースに`contractExpiry: string`を追加
- `toContractRecord`：`contractExpiry`のマッピングを追加
- `isActiveAnnualRecord`（月額の`isActiveMonthlyRecord`相当）：`billingCycle === "年額"` かつ `contractStatus2 === "契約中"`
- `filterActiveAnnualRecords`・`extractUniqueInstances`・`filterRecordsByInstance`・`findBaseRecord`（`BASE_CATEGORY`は`contract-change-shared-logic`からimport）：月額と同じロジック
- `CurrentContractSummary`に`contractExpiry: string`を追加し、`buildCurrentContractSummary`でベース行の`contractExpiry`をセット
- `ContractLineItem`・`buildLineItems`：月額と同じ構造（`category`含む、ステップc用）。**「nヶ月分」商品の年間商品読み替えは行わない**（フェーズ2、商品マスタ連携のブロッカー未解消のため今回は対象外。取得した商品コード・商品名をそのまま表示する）

### 2. `annual-contract-change.ts`

月額版[ステップa実装](../../src/forms/monthly-contract-change.ts#L1-L138)と同じ構成でイベントハンドラーを実装する（DOM操作パターン・フェイルセーフの考え方も含めて踏襲）。

- パーツID定数：`INSTANCE_NAME_PART_ID`, `CORPORATE_NAME_PART_ID`, `CURRENT_PLAN_PART_ID`, `CURRENT_USER_COUNT_PART_ID`は月額と同じID（[パーツID設計](../forms/requirements/【クラウド版】注文書兼利用申込書（年額：契約変更）_パーツID設計.md)で確認済み、月額と共通）。新規に`CONTRACT_EXPIRY_PART_ID = "fidCurrentContractExpiry"`を追加
- 明細テーブル列パーツID（`LINE_ITEM_COLUMN_PART_IDS`）：月額と同じ列構成（`fidChangedProductName`等）。`table_index: 1`のためテーブルパーツIDは月額と同じ`tbl_1`固定（コラボフォーム仕様、[parts-reference.md](../collaboform-js-api/parts-reference.md)参照）
- `form.show`イベントで`collaboform.proxy.call('kintone-contract-db')`を呼び出し、`filterActiveAnnualRecords`で年額レコードのみ抽出（月額は`filterActiveMonthlyRecords`を使うが、年額側は本ファイル内の`filterActiveAnnualRecords`を使う）
- インスタンス名抽出→単一/複数でのプルダウン代替UI構築（月額と全く同じDOM操作パターン。`lockInstanceNameField`・`buildInstanceSelector`を本ファイル内に複製）
- `applyInstanceData`：法人名・現在契約プラン・現在契約ユーザー数に加え、**契約期限（`fidCurrentContractExpiry`）もセット**する（`buildCurrentContractSummary`が返す`contractExpiry`をそのままセット。kintoneのDATE型フィールドの値は`YYYY-MM-DD`形式で返るため、コラボフォームの`date`型パーツにそのまま渡せる想定。実機確認で書式を確認する）
- `applyLineItemsToTable`：月額と同じロジックで明細テーブルへ反映
- フェイルセーフ（月額のTC-17〜TC-23相当の教訓を踏襲）：`instanceSelectorInitFailed`・`baseRecordMissing`・`noActiveContractFound`・`lineItemsExceedTableCapacity`・`kintoneCallFailed`を本ファイル内に複製し、`form.confirm`/`form.submit`でブロック
- ローディング表示（`showLoadingOverlay`/`hideLoadingOverlay`）も同様に複製

### 重複実装についての方針

DOM操作関連の関数（`lockInstanceNameField`, `buildInstanceSelector`, ローディング表示等）は月額・年額で完全に同一のロジックだが、今回は**複製する**（共通化しない）。理由：
- フェーズ4計画のアーキテクチャ方針で決定した共通化対象（営業日計算・ユーザー数整合性チェック）に含まれておらず、今回新たに共通化するかはスコープ外の判断が必要
- DOM操作コードは`document.getElementById`等ブラウザAPIに依存しており、現在の`contract-change-shared-logic.ts`（DOM非依存の純粋ロジックのみ）とは性質が異なる
- 将来的に共通化する価値はあるが、月額版の稼働中コードへの影響範囲を広げないため、本ステップでは複製に留める（要すれば別途提案する）

## 影響範囲

- 新規ファイルのみ追加。月額版フォーム（`monthly-contract-change.ts`等）・他フォームへの影響なし
- DOM構造に依存する非公式な実装のため、コラボフォーム側のUI変更で動作しなくなるリスクがある（月額版と同様のリスク）
- `kintone-contract-db`エンドポイントは月額版と共用（顧客番号の絞り込みは既存のプロキシ仕様のまま、年額レコードの絞り込みはJS側の`filterActiveAnnualRecords`で行う）

## 確認方法

1. Claudeが`npm run lint` / `npm run typecheck` / `npm run test` / `npm run build`を実行
2. ユーザーが検証環境（年額版フォーム）にアップロードし、ブラウザコンソールで以下を確認し結果を共有
   - 法人名・現在契約プラン・現在契約ユーザー数・契約期限が正しく表示されること
   - 契約期限の表示形式が`fidCurrentContractExpiry`（date型パーツ）で問題なく表示されること（書式相違があれば変換処理を追加）
   - 複数インスタンス時のプルダウン切り替えで値が再セットされること
   - 明細テーブルに現在契約商品が表示されること
   - フェイルセーフ動作（プロキシ呼び出し失敗時等）が月額版と同様に機能すること

## 今回やらないこと（切り出し）

- ステップb（変更後契約数のデフォルト値／解約チェック連動）以降は次のステップとして別途計画する

## 実装状況（2026-09-28）

コード実装が完了。`src/forms/annual-contract-change-logic.ts`・`src/forms/annual-contract-change.ts`・`tests/forms/annual-contract-change-logic.test.ts`を新規作成し、`scripts/build.mjs`の`forms`配列に`annual-contract-change`を追加。`npm run lint` / `npm run typecheck` / `npm test`（58件、月額42件＋年額16件）/ `npm run build`（`dist/forms/annual-contract-change.js`生成）をすべて確認済み。詳細は[実施記録](../agent-records/2026-09-28_フェーズ4ステップa_年額版インスタンス名UIとkintone連携_実装.md)参照。

**次のアクション**：ユーザーが検証環境（年額版フォーム）に`dist/forms/annual-contract-change.js`をアップロードし、上記「確認方法」の各項目を実機確認。結果共有後、本計画をcompletedに更新する。

## 実機確認対応（2026-10-02）

ユーザーが検証環境にアップロードし確認した結果、コラボフォームのプロキシAPI設定がフォーム単位であるため、月額版と同じ`kintone-contract-db`エンドポイントを年額版から呼び出せないことが判明。年額版専用エンドポイント`kintone-contract-db-annual`をユーザーが検証環境で新規作成し、`annual-contract-change.ts`の`KINTONE_CONTRACT_DB_ENDPOINT`を変更した（[docs/kintone/README.md](../kintone/README.md)エンドポイント1-b参照）。`npm run lint` / `npm run typecheck` / `npm test` / `npm run build`再確認済み。

その他の確認項目（法人名・現在契約プラン・現在契約ユーザー数・契約期限の表示、複数インスタンス切り替え、明細テーブル表示、フェイルセーフ動作）の結果は別途共有待ち。

## テスト環境ライセンス専用インスタンスの不具合修正（2026-10-02）

実機確認で、同一顧客番号に2インスタンスがあり片方がテスト環境ライセンス専用（区分=ベースの行が存在しない）の場合に`baseRecordMissing`が誤検知される不具合が発見された。月額版にも同一ロジックがあるため、`contract-change-shared-logic.ts`に`findBaseOrTestEnvLicenseRecord`を追加し、月額・年額両方の`findBaseRecord`から共通利用する形で修正した。`npm run lint` / `npm run typecheck` / `npm test`（70件）/ `npm run build`で確認済み。詳細は[実施記録](../agent-records/2026-10-02_テスト環境ライセンス専用インスタンスのベース判定修正.md)参照。

## 完了（2026-10-02）

残っていた5項目（法人名・現在契約プラン・現在契約ユーザー数・契約期限の表示、契約期限の表示形式、複数インスタンス切り替え、明細テーブル表示、フェイルセーフ動作）をユーザーが検証環境で実機確認し、すべて正常動作を確認した。

ステップaはこれでクローズ。次はステップb（変更後契約数のデフォルト値／解約チェック連動、フル年額商品のみ対象）に着手する（[フェーズ4計画](2026-09-25_フェーズ4_年額契約変更カスタマイズ計画.md)参照）。
