---
type: task-record
date: 2026-09-02
status: resolved   # 2026-09-02 全実機確認完了によりクローズ
tags: [顧客ポータル, 月額契約変更, kintone連携, フェーズ1]
related:
  - docs/plans/2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md
  - docs/kintone/クラウド契約管理DB.md
  - docs/kintone/json/クラウド契約管理DB_getFormFields.json
resolves: []
---

# フェーズ1ステップa：インスタンス名UI＋kintoneから現在契約情報を取得・表示（実装）

- 日付: 2026-09-02
- 担当: Claude（ken-collabostyleの指示のもと）

## 背景・目的

[フェーズ1全体計画](../plans/2026-08-24_顧客ポータルカスタマイズ全体計画.md)のステップaとして、【クラウド版】注文書兼利用申込書（月額：契約変更）フォームに、インスタンス名選択UI（複数契約時はプルダウン）とkintone連携（現在契約プラン・法人名・ユーザー数・明細の自動セット）を実装する。事前に[詳細計画](../plans/2026-08-25_フェーズ1ステップa_インスタンス名UIとkintone連携.md)をユーザー承認済み。

また、計画のインスタンス選択プルダウンはコラボフォームJS APIの公式サポート外（DOM構造への直接依存）であるため、ユーザーからの追加要望として「DOM構造が変化して動作しなかった場合、その旨をユーザーに分かるようにし、申請ボタンのクリックを禁止する」フェイルセーフの実装も計画に追加した。

## 調査内容（Reasoning）

- `docs/collaboform-js-api/events-reference.md`で`form.confirm`/`form.submit`が`false`をreturnすることで画面遷移・送信を中止できる公式APIであることを確認。DOM依存のプルダウン構築が失敗した場合の申請ブロックには、DOM構造の変化に影響されないこの公式イベントを採用した。
- `docs/kintone/クラウド契約管理DB.md`（実装メモ突合版）を確認したところ、明細テーブル（`fidChangedProductName`等）にセットすべきkintone側フィールドの対応関係が未定義であることが判明。ユーザーに確認したところ、kintoneの`getFormFields` API生レスポンスを新たに提供いただいた（[docs/kintone/json/クラウド契約管理DB_getFormFields.json](../kintone/json/クラウド契約管理DB_getFormFields.json)）。
- 生JSONと既存マークダウンを突合した結果、以下のフィールドコードの誤りを発見・修正した（詳細は`docs/kintone/クラウド契約管理DB.md`参照）。
  - 誤: `月額・年額` → 正: `月額年額`
  - 誤: `単価_月額税抜` → 正: `単価_月額_税抜`
  - 誤: `契約金額_月額のみ税抜` → 正: `契約金額`
  - 誤: `種類2`（半角2）→ 正: `種類２`（全角2）
- 生JSONから新たに`サービス名_請求書用`（商品名候補）、`契約ステータス2`（詳細ステータス）の存在が判明。ユーザーに確認のうえ、以下を決定した。
  - 明細の「変更後商品名」には`サービス名_請求書用`を使用する
  - 「現在契約中のレコード」の判定条件は `区分`="ベース" かつ `月額年額`="月額" かつ `契約ステータス2`="契約中" とする
- 明細の「変更後商品単位」（`fidChangedProductUnit`）に対応するkintoneフィールドは生JSON上に見当たらなかった。当てずっぽうで実装するとデータ不整合のリスクがあるため、今回は空欄のまま実装し、未解決課題として申し送ることとした（ユーザーには本記録の完成後に別途確認予定）。

## 実施内容（Acting）

- `src/types/collaboform.d.ts`：コラボフォームJS APIのグローバル型定義を新規作成（`collaboform.events.on` / `collaboform.proxy.call` / `parts`オブジェクト等）
- `src/forms/monthly-contract-change-logic.ts`：DOM・collaboform APIに依存しない純粋ロジックを新規作成（`isActiveMonthlyRecord` / `extractUniqueInstances` / `filterRecordsByInstance` / `findBaseRecord` / `buildCurrentContractSummary` / `buildLineItems`）
- `src/forms/monthly-contract-change.ts`：フォーム専用エントリーポイントを新規作成
  - `form.show`で`kintone-contract-db`を呼び出し、現在契約中の月額レコードをキャッシュ
  - インスタンス名が1件なら`parts`経由でテキストパーツに直接セット、複数件ならDOM操作でプルダウンUIを構築（`document.getElementById('fidContractedInstanceName')` + `.mantine-Input-wrapper`）
  - プルダウン選択時・初期表示時に、法人名・現在契約プラン・現在契約ユーザー数・明細テーブル（`fidChangedProduct*` / `fidCurrentProductQuantity`）をローカルキャッシュから再セット（kintoneへの再リクエストなし）
  - **フェイルセーフ**：DOM構造不一致（`getElementById`または`.mantine-Input-wrapper`が取得不可）を検知した場合、`console.error`出力と`alert()`表示でユーザーに通知し、`instanceSelectorInitFailed`フラグを立てる。`form.confirm`・`form.submit`の両方でこのフラグを見て`false`をreturnし、申請そのものをブロックする
- `src/forms/monthly-contract-change-logic.ts`のテストを`tests/forms/monthly-contract-change-logic.test.ts`に新規作成（14ケース、正常系・境界値・異常系）
- ビルド未整備だったため、`esbuild`を追加し`scripts/build.mjs`・`npm run build`を新規整備（IIFE形式1ファイルにバンドル、コラボフォームへの単一JSアップロード運用に対応）
- `tsconfig.json`の`rootDir`/`outDir`設定が`tests/`配下のファイルと矛盾しコンパイルエラーになったため削除（ビルドはesbuildが担うため、tscは型チェック専用としてこれらの設定は不要と判断）
- `docs/kintone/クラウド契約管理DB.md`・`docs/kintone/README.md`のフィールドコード誤りを修正し、生JSONファイルへの参照を追加

## 結果・観察（Observation）

- `npm run lint`：エラーなし
- `npm run typecheck`：エラーなし（日本語・全角文字を含むプロパティ名を含め型チェック通過を確認）
- `npm run test`：14件全て成功
- `npm run build`：`dist/forms/monthly-contract-change.js`を生成し、import/export等のESM構文が残らずグローバル`collaboform`を参照するプレーンなIIFEになっていることを目視確認
- 検証環境での実機確認は未実施（`kintone-contract-db`のquery固定値・テスト用顧客番号が未設定のため。[全体計画](../plans/2026-08-24_顧客ポータルカスタマイズ全体計画.md)参照）

## 得られた知見・製品への示唆

- kintoneのフィールドコードは、要求事項ドキュメントの記載だけでなく`getFormFields` APIの生レスポンスで必ず突合すべき（半角/全角の数字違い、ラベルとコードの不一致など、目視だけでは気づきにくい誤りが複数見つかった）
- コラボフォームJS APIのDOM非依存な公式イベント（`form.confirm`/`form.submit`のfalse return）は、DOM依存の非公式実装（Mantine構造への直接アクセス）が失敗した場合のフェイルセーフとして有効。「非公式な実装のリスクを、公式APIのフェイルセーフで受け止める」設計パターンとして次のステップ以降でも再利用できる

## 追記（2026-09-02、フィールドコードマッピングの分離）

ユーザーから「kintoneフィールドコードは設定で変更されうるため、変更時の影響箇所を最小化したい」との要望を受け、以下の設計変更を追加実施した。

- `CONTRACT_DB_FIELD_CODES`（フィールドコード対応表）を`monthly-contract-change-logic.ts`に集約し、これ以外の箇所からkintoneのフィールドコード文字列を一切参照しない構成に変更
- `toContractRecord()`アダプター関数を追加し、kintoneの生レコード（フィールドコードがキー）を、安定した名前を持つ内部ドメインモデル`ContractRecord`（`instanceName` / `corporateName` / `category`等）に変換
- `isActiveMonthlyRecord`等の既存ロジック関数・テストは全て内部ドメインモデルのみを参照するよう書き換え
- 効果：将来kintone側でフィールドコードが変更された場合、`CONTRACT_DB_FIELD_CODES`の1箇所を修正するだけで済む
- `npm run lint` / `npm run typecheck` / `npm run test`（16件、`toContractRecord`のテスト2件を追加）はすべて通過

## 未解決課題・申し送り事項

- ~~明細テーブルの「変更後商品単位」（`fidChangedProductUnit`）に対応するkintoneフィールドが見つからない。現状は空欄のまま。ユーザーに別途確認が必要（固定文言でよいか、他アプリに情報があるか等）~~ → **解消（2026-09-02）**：実機確認TC-26でユーザーが空欄表示のまま運用上問題ないことを確認。対応不要と判断
- ~~`kintone-contract-db`エンドポイントのquery固定値（テスト用顧客番号）が未設定のため、検証環境での実機動作確認が未実施。設定完了後にユーザーが確認する~~ → **解消（2026-09-02）**：query固定値設定完了、TC-17以降の実機確認を実施済み
- ~~フェイルセーフ（DOM構造不一致時の申請ブロック）自体の動作確認（意図的にID/クラス名を壊すテスト＝テスト仕様書TC-20）は未実施のまま残っている~~ → **解消（2026-09-02）**：ユーザーが実機確認を完了
